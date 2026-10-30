// Halden: 59.1243 N, 11.3875 E (MET krever maks 4 desimaler)
const URL_API = "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=59.1243&lon=11.3875";

const TXT = {
    clearsky: ["Klarvær", "☀️", "🌙"], fair: ["Lettskyet", "🌤️", "🌙"], partlycloudy: ["Delvis skyet", "⛅", "☁️"],
    cloudy: ["Skyet", "☁️", "☁️"], fog: ["Tåke", "🌫️", "🌫️"],
    lightrain: ["Lett regn", "🌦️", "🌧️"], rain: ["Regn", "🌧️", "🌧️"], heavyrain: ["Kraftig regn", "🌧️", "🌧️"],
    lightrainshowers: ["Lette regnbyger", "🌦️", "🌧️"], rainshowers: ["Regnbyger", "🌦️", "🌧️"], heavyrainshowers: ["Kraftige regnbyger", "🌧️", "🌧️"],
    lightsleet: ["Lett sludd", "🌨️", "🌨️"], sleet: ["Sludd", "🌨️", "🌨️"], heavysleet: ["Kraftig sludd", "🌨️", "🌨️"],
    lightsleetshowers: ["Lette sluddbyger", "🌨️", "🌨️"], sleetshowers: ["Sluddbyger", "🌨️", "🌨️"], heavysleetshowers: ["Kraftige sluddbyger", "🌨️", "🌨️"],
    lightsnow: ["Lett snø", "🌨️", "🌨️"], snow: ["Snø", "❄️", "❄️"], heavysnow: ["Kraftig snø", "❄️", "❄️"],
    lightsnowshowers: ["Lette snøbyger", "🌨️", "🌨️"], snowshowers: ["Snøbyger", "🌨️", "🌨️"], heavysnowshowers: ["Kraftige snøbyger", "❄️", "❄️"]
};

function sym(code) {
    code = code || "cloudy";
    const night = /_night$/.test(code);
    let base = code.replace(/_(day|night|polartwilight)$/, "");
    const thunder = base.includes("andthunder");
    base = base.replace("andthunder", "");
    const t = TXT[base] || ["Ukjent", "☁️", "☁️"];
    return { text: thunder ? t[0] + " med torden" : t[0], icon: thunder ? "⛈️" : (night ? t[2] : t[1]), night };
}

const $ = id => document.getElementById(id);
const oslo = { timeZone: "Europe/Oslo" };
const fmtT = n => Math.round(n) + "°";
const hourOf = d => new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", hourCycle: "h23", ...oslo }).format(d) + ":00";
const hourNum = d => parseInt(hourOf(d), 10);
const dayKey = d => new Intl.DateTimeFormat("sv-SE", oslo).format(d);
const shortDay = d => new Intl.DateTimeFormat("nb-NO", { weekday: "short", ...oslo }).format(d).replace(".", "");
const longDay = d => new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", ...oslo }).format(d);
const compass = deg => ["N", "NØ", "Ø", "SØ", "S", "SV", "V", "NV"][Math.round(deg / 45) % 8];
const mm = n => (Math.round(n * 10) / 10).toString().replace(".", ",") + " mm";

let DAYS = [];       // alle dagene med oppføringer
let selected = 0;    // valgt dag

function entryInfo(e) {
    const d = e.data.instant.details;
    const hasHour = !!e.data.next_1_hours;
    const next = e.data.next_1_hours || e.data.next_6_hours;
    return {
        date: new Date(e.time),
        temp: d.air_temperature,
        wind: d.wind_speed,
        dir: d.wind_from_direction,
        hum: d.relative_humidity,
        pres: d.air_pressure_at_sea_level,
        precip: next?.details?.precipitation_amount ?? 0,
        sixHour: !hasHour,
        code: next?.summary?.symbol_code
    };
}

function buildDays(ts) {
    const map = {};
    ts.forEach(e => {
        const info = entryInfo(e), k = dayKey(info.date);
        (map[k] ||= { date: info.date, items: [] }).items.push(info);
    });
    return Object.values(map).map(day => {
        const it = day.items, temps = it.map(x => x.temp);
        const noon = it.find(x => Math.abs(hourNum(x.date) - 12) <= 1 && x.code) || it.find(x => x.code);
        return {
            date: day.date, items: it,
            min: Math.min(...temps), max: Math.max(...temps),
            rain: it.reduce((s, x) => s + x.precip, 0),
            wind: Math.max(...it.map(x => x.wind)),
            hum: it.reduce((s, x) => s + x.hum, 0) / it.length,
            pres: it.reduce((s, x) => s + x.pres, 0) / it.length,
            code: (noon?.code || "cloudy").replace("_night", "_day")
        };
    });
}

function drawTabs() {
    $("tabs").innerHTML = DAYS.map((day, i) => {
        const sy = sym(day.code);
        return `<button class="tab" data-i="${i}" aria-pressed="${i === selected}">
      <div class="n">${i === 0 ? "I dag" : shortDay(day.date)}</div>
      <div class="i">${sy.icon}</div>
      <div class="r">${fmtT(day.max)} <span>${fmtT(day.min)}</span></div></button>`;
    }).join("");
}

function drawDetail() {
    const day = DAYS[selected];
    $("dayTitle").textContent = (selected === 0 ? "I dag, " : "") + longDay(day.date);
    $("dayStats").innerHTML = [
        ["Høyeste", fmtT(day.max)], ["Laveste", fmtT(day.min)],
        ["Nedbør", mm(day.rain)], ["Sterkeste vind", Math.round(day.wind) + " m/s"],
        ["Luftfuktighet", Math.round(day.hum) + " %"], ["Lufttrykk", Math.round(day.pres) + " hPa"]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

    $("rows").innerHTML = day.items.map(x => {
        const sy = sym(x.code);
        return `<div class="rows">
      <span>${hourOf(x.date)}</span><span class="i" title="${sy.text}">${sy.icon}</span>
      <span>${fmtT(x.temp)}</span>
      <span class="${x.precip > 0 ? "wet" : ""}">${x.precip > 0 ? mm(x.precip) : "0"}${x.sixHour && x.precip > 0 ? " <small>/6t</small>" : ""}</span>
      <span>${Math.round(x.wind)} m/s <small>${compass(x.dir)}</small></span>
      <span>${Math.round(x.hum)} %</span></div>`;
    }).join("");
}

function select(i) {
    selected = i;
    drawTabs();
    drawDetail();
}

function render(data) {
    const ts = data.properties.timeseries;
    const now = ts[0], d = now.data.instant.details;
    const s = sym(now.data.next_1_hours?.summary.symbol_code || now.data.next_6_hours?.summary.symbol_code);

    DAYS = buildDays(ts);
    if (selected >= DAYS.length) selected = 0;

    $("temp").textContent = fmtT(d.air_temperature);
    $("cond").textContent = s.icon + " " + s.text;
    $("hl").textContent = "H: " + fmtT(DAYS[0].max) + "   L: " + fmtT(DAYS[0].min);
    $("wind").textContent = Math.round(d.wind_speed) + " m/s fra " + compass(d.wind_from_direction);
    $("hum").textContent = Math.round(d.relative_humidity) + " %";
    $("rain").textContent = mm(now.data.next_1_hours?.details?.precipitation_amount ?? 0);
    $("pres").textContent = Math.round(d.air_pressure_at_sea_level) + " hPa";
    $("foot").textContent = "Data fra MET Norway (Yr). Oppdatert " +
        new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", ...oslo }).format(new Date());
    document.body.classList.toggle("night", s.night);

    select(selected);
    $("msg").hidden = true;
    $("app").hidden = false;
}

$("tabs").addEventListener("click", e => {
    const b = e.target.closest(".tab");
    if (b) select(+b.dataset.i);
});

async function load() {
    try {
        const r = await fetch(URL_API);
        if (!r.ok) throw new Error("Svar " + r.status);
        render(await r.json());
    } catch (err) {
        if ($("app").hidden) {
            $("msg").textContent = "Kunne ikke hente været. Sjekk internett og prøv igjen. (" + err.message + ")";
        }
    }
}
load();
setInterval(load, 30 * 60 * 1000); // oppdaterer hvert 30. minutt

// Gjør "nå"-boksen kompakt når man scroller
const nowBox = document.querySelector(".now");
addEventListener("scroll", () => {
    if (scrollY > 140) nowBox.classList.add("compact");
    else if (scrollY < 60) nowBox.classList.remove("compact");
}, { passive: true });