// turn on to use local fake data
const DEBUG = false;

function shouldBeBig() {
    return window.innerWidth > 800;
}

let IS_BIG = shouldBeBig();

/* Debug functions */

function randInt(minOrMax, max) {
    if (max === undefined) {
        return Math.floor(Math.random() * minOrMax);
    }
    return Math.floor(Math.random() * (max - min) + min);
}

function randBool() {
    return randInt(2) === 0;
}

function choice(items, n=1) {
    if (n === 1) {
        return items[randInt(items.length)];
    }

    const ret = [];
    for (let i = 0; i < n; i++) {
        const index = randInt(items.length);
        ret.push(items[index]);
        items.splice(index, 1);
    }
    return ret;
}

function weightedChoice(items) {
    return items[items.length - 1 - Math.floor(Math.log2(randInt(2 ** items.length - 1) + 1))];
}

function getTime(t, interval="hours") {
    if (interval === "hours") {
        const now = new Date();
        now.setMinutes(0);
        now.setSeconds(0);
        now.setHours(now.getHours() - t);
        return now;
    } else if (interval === "minutes") {
        const now = new Date();
        now.setSeconds(0);
        now.setMinutes(now.getMinutes() - t);
        return now;
    }
}

function generateGraphData() {
    function genHitsRow(time) {
        return {
            time: time,
            hits: randInt(100),
        };
    }

    function genLoadRow(time) {
        return {
            timestamp: time,
            avg: Math.random(),
        };
    }

    const numDataPoints = 12;
    const hitsRows = [];
    const loadRows = [];
    for (let i = 0; i < numDataPoints; i++) {
        hitsRows.push(genHitsRow(getTime(numDataPoints - 1 - i)));
        loadRows.push(genLoadRow(getTime(numDataPoints - 1 - i)));
    }

    const hitsReturn = {
        status: "ok",
        result: hitsRows,
    };
    const loadReturn = {
        status: "ok",
        result: loadRows,
    };
    return [hitsReturn, loadReturn];
}

function generateRowData(numRows) {
    function randomIp() {
        return `${randInt(256)}.${randInt(256)}.${randInt(256)}.${randInt(256)}`;
    }

    function randomHost(isApi) {
        if (isApi) {
            return weightedChoice(["api.aeromancer.dev", "api.yeats.dev"]);
        } else {
            return weightedChoice(["aeromancer.dev", "yeats.dev", "54.176.40.80", "www.aeromancer.dev", "www.yeats.dev"]);
        }
    }

    function randomPath(isApi) {
        const mainPaths = ["/", "/projects/", "/games/", "/games/chess/", "/games/shobu/", "/xkcd/", "/contact/"];
        const apiPaths = ["/v1/load", "/v1/traffic", "/v1/requests"];
        const apiParams = ["exclude_failures=true", "limit=100", "offset=200", "exclude_api=true", "num_buckets=10", "exclude_spam=true"];

        if (isApi) {
            let path = choice(apiPaths);
            const params = choice(apiParams, 3)
            path += "?" + params.join("&");
            return path;
        } else {
            return choice(mainPaths);
        }
    }

    function randomUserAgent() {
        if (randBool()) {
            const parts = ["AppleWebKit/601.7.7", "AppleWebKit/537.36", "Chrome/81.0.4044.129", "Safari/537.36", "Gecko/20100101"];
            return "Mozilla/5.0 " + choice(parts, 3).join(" ");
        } else if (randBool()) {
            return "-";
        } else {
            return choice([
                "Expanse, a Palo Alto Networks company, searches across the global IPv4 space multiple times per day to identify customers&#39; presences on the Internet. If you would like to be excluded from our scans, please send IP addresses/domains to: scaninfo@paloaltonetworks.com",
                "Mozilla/5.0 [https://about.censys.io/]",
                "python-requests/2.22.0",
                "ALittle Client",
                "-",
            ]);
        }
    }

    function genRow(time) {
        const isApi = randBool();
        return {
            timestamp: time,
            ip: randomIp(),
            status: choice([200, 301, 400, 401, 404, 501, 503]),
            httpMethod: choice(["GET", "POST", "OPTIONS", "HEAD"]),
            tls: weightedChoice(["", "TLSv1.2", "TLSv1.3"]),
            os: choice(["Windows", "Mac", "iPhone", "Android", "Linux", "Spider"]),
            host: randomHost(isApi),
            path: randomPath(isApi),
            userAgent: randomUserAgent(),
        };
    }

    const rows = [];
    for (let i = 0; i < numRows; i++) {
        rows.push(genRow(getTime(i, "minutes")));
    }

    return {
        status: "ok",
        result: rows,
    };
}



/* API functions */

const API_ROOT = "https://api.aeromancer.dev/v1";
const API_KEY = localStorage.getItem("apiKey");

function getApiResponse(url, method="GET") {
    return fetch(url, {
        method: method,
        headers: {
            "X-API-Key": API_KEY,
        },
    })
        .then((response) => response.json())
        .catch(() => {
            console.error(`Error ${method}ing ${url}`);
            return undefined;
        });
}

function getFilterParams() {
    function isSelected(buttonId) {
        return document.getElementById(buttonId).classList.contains("selected");
    }

    const excludeFailures = isSelected("button-exclude-failures");
    const excludeApiCalls = isSelected("button-exclude-api");
    const excludeAssets = isSelected("button-exclude-assets");
    const excludeSpam = isSelected("button-exclude-spam");

    let filters = [];
    let excludedPaths = [];
    let excludedFileTypes = [];

    if (excludeFailures) {
        filters.push("exclude_failures=true");
    }

    if (excludeApiCalls) {
        excludedPaths.push("/v1/");
    }

    if (excludeAssets) {
        excludedFileTypes = excludedFileTypes.concat(["jpg", "jpeg", "png", "webp", "ico", "js", "css", "ttf", "glsl"]);
    }

    if (excludeSpam) {
        filters.push("exclude_spam=true");
    }


    if (excludedPaths.length > 0) {
        filters.push(`exclude_paths=${encodeURIComponent(excludedPaths.join(","))}`);
    }

    if (excludedFileTypes.length > 0) {
        filters.push(`exclude_file_types=${encodeURIComponent(excludedFileTypes.join(","))}`);
    }

    if (filters.length > 0) {
        return filters.join("&");
    }

    return "";
}



/* General UI */

function chartCollapseSetup() {
    document.getElementById("toggle-chart-hitbox").addEventListener("click", (e) => {
        document.getElementById("toggle-chart-icon").classList.toggle("rotated");
        document.getElementById("bottom-wrapper").classList.toggle("expanded");
        document.getElementById("chart-wrapper").classList.toggle("faded-out");
    });
}



/* Chart functions */

function dateStringToLabel(string, round) {
    const date = new Date(string);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, "0")

    const showDays = round.includes("days");
    const showHours = round.includes("hours");
    const showMinutes = round.includes("minutes");

    let stringParts = [];
    if (showDays) {
        if (month === 1 && day === 1) {
            stringParts.push(`${month}/${day}/${year}`);
        } else {
            stringParts.push(`${month}/${day}`);
        }
    }
    if (showHours && !showMinutes) {
        if (hour === 0 && !showDays) {
            stringParts.push(`${month}/${day}`);
        }
        stringParts.push(`${hour}:00`);
    } else if (showHours || showMinutes) {
        if (showHours === 0 && showMinutes === 0 && !showDays) {
            stringParts.push(`${month}/${day}`);
        }
        stringParts.push(`${hour}:${minute}`);
    }
    return stringParts.join(" ");
}

function unzip(array) {
    let ret = {}
    for (let key of Object.keys(array[0])) {
        ret[key] = [];
    }

    for (let elem of array) {
        for (let key of Object.keys(array[0])) {
            ret[key].push(elem[key]);
        }
    }

    return ret;
}

async function showGraph(chart, bucketMins=60, buckets=12) {
    const filterParams = getFilterParams();
    const chunk = new Date(Date.UTC(2000, 0, 1) + new Date().getTimezoneOffset() * 60 * 1000).toISOString().slice(0, -1);
    const trafficUrl = `${API_ROOT}/traffic?interval=${bucketMins}%20minute&num_buckets=${buckets}&chunk_rounding=${chunk}&${filterParams}`;
    const loadUrl = `${API_ROOT}/load?limit=${buckets}`;

    let trafficData, loadData;
    if (DEBUG) {
        [trafficData, loadData] = generateGraphData();
    } else {
        [trafficData, loadData] = await Promise.all([getApiResponse(trafficUrl), getApiResponse(loadUrl)]);
    }

    if (trafficData) {
        const trafficResults = unzip(trafficData.result);
        const labels = trafficResults.time.map(t => dateStringToLabel(t, ["hours", "minutes"]));
        const hits = trafficResults.hits;

        chart.data.labels = labels;
        chart.data.datasets[0].data = hits;
    }

    if (loadData) {
        const loadResults = loadData ? unzip(loadData.result) : [];
        const load = loadResults.avg;

        chart.data.datasets[1].data = load;
    }

    chart.update();
}

function createChart(elemId) {
    const ctx = document.getElementById(elemId);
    return new Chart(ctx, {
        data: {
            labels: null,
            datasets: [{
                type: "line",
                label: "Hits",
                borderColor: "#3DA3E8",
                backgroundColor: "#3DA3E8",
                data: null,
            }, {
                type: "line",
                label: "Load",
                fill: {
                    target: "origin",
                    above: "#f002",
                },
                borderWidth: 1,
                borderColor: "#FD658588",
                yAxisID: "yLoad",
                data: null,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: "Traffic overview",
                    color: "white",
                },
            },
            scales: {
                x: {
                    grid: {
                        color: "#444",
                    },
                    ticks: {
                        color: "white",
                    },
                },
                y: {
                    suggestedMin: 0,
                    suggestedMax: 10,
                    grid: {
                        color: "#444",
                    },
                    ticks: {
                        color: "white",
                    },
                },
                yLoad: {
                    position: "right",
                    suggestedMin: 0,
                    suggestedMax: 1,
                    ticks: {
                        color: "#aaa",
                    },
                },
            },
        },
    });
}



/* Button functions */
function setButtonHandlers(chart, gridOptions) {
    const buttonIds = [
        "button-exclude-failures",
        "button-exclude-api",
        "button-exclude-assets",
        "button-exclude-spam",
    ];
    for (let id of buttonIds) {
        document.getElementById(id).addEventListener("click", (elem) => {
            elem.srcElement.classList.toggle("selected");
            gridOptions.api.setDatasource(apiDatasource);
            showGraph(chart);
        });
    }

    document.getElementById("button-toggle-params").addEventListener("click", () => {
        document.getElementById("log-entries").classList.toggle("hide-params");
        gridOptions.columnApi.autoSizeColumns(["path", "userAgent"])
    });
}



/* Grid functions */

function strftime(date, format) {
    function pad(string, len=2) {
        return string.toString().padStart(len, "0");
    }
    const weekdaysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdaysLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthsLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
        "October", "November", "December"]
    const formatFuncs = {
        a: () => weekdaysShort[date.getDay()],
        A: () => weekdaysLong[date.getDay()],
        w: () => date.getDay(),
        d: () => pad(date.getDate()),
        b: () => monthsShort[date.getMonth()],
        B: () => monthsLong[date.getMonth()],
        m: () => pad(date.getMonth() + 1),
        y: () => pad(date.getFullYear() % 100),
        Y: () => pad(date.getFullYear(), 4),
        H: () => pad(date.getHours()),
        I: () => pad((date.getHours() + 11) % 12 + 1),
        p: () => date.getHours() < 12 ? "AM" : "PM",
        M: () => pad(date.getMinutes()),
        S: () => pad(date.getSeconds()),
        f: () => pad(date.getMilliseconds(), 3),
        z: () => {
            const offset = Math.abs(date.getTimezoneOffset());
            const offsetSign = Math.sign(date.getTimezoneOffset()) === 1 ? "-" : "+";
            const offsetHours = Math.floor(offset / 60);
            const offsetMinutes = offset % 60;
            return offsetSign + pad(offsetHours) + pad(offsetMinutes);
        },
        Z: () => date.toString().match("\\((.*)\\)")[1],
        j: () => {
            const currentDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
            const yearStart = Date.UTC(date.getFullYear(), 0, 0);
            const dayOfYear = (currentDay - yearStart) / 24 / 60 / 60 / 1000;
            return pad(dayOfYear, 3);
        },
        "%": () => "%",
    }

    let dateString = "";
    for (let c = 0; c < format.length; c++) {
        let char = format[c];
        if (char === "%") {
            if (c === format.length - 1) {
                dateString += "%";
                break;
            }

            c++;

            char = format[c];
            if (formatFuncs[char] !== undefined) {
                dateString += formatFuncs[char]();
            } else {
                dateString += `%${char}`;
            }
        } else {
            dateString += char;
        }
    }

    return dateString;
}

function makeColumnDefs(isBig) {
    function paramsToggle(params) {
        if (!params.getValue()){
            return;
        }

        const string = params.getValue();
        const paramsStart = string.indexOf("?");
        if (paramsStart === -1) {
            return string;
        }
        const basePath = string.substring(0, paramsStart);
        const urlParams = string.substring(paramsStart);
        return `${basePath}<span class="cell-params">${urlParams}</span>`;
    }

    const timestampCol = {
        headerName: "Timestamp",
        field: "timestamp",
        cellClass: "log-cell",
        width: 80,
    };

    const ipCol = {
        headerName: "IP",
        field: isBig ? "ip" : undefined,
        cellClass: "log-cell",
        width: 200,
    };

    const osCol = {
        headerName: "OS",
        field: "os",
        cellClass: "log-cell",
        width: 32,
        minWidth: isBig ? 70 : undefined,
    };

    const statusCol = {
        headerName: isBig ? "Status" : "S",
        field: "status",
        cellClass: "log-cell",
        width: 26,
    };

    const methodCol = {
        headerName: isBig ? "Method" : "M",
        field: "httpMethod",
        cellClass: "log-cell",
        width: 32,
    };

    const tlsCol = {
        headerName: "TLS",
        field: "tls",
        cellClass: "log-cell",
        width: 26,
    };

    const hostCol = {
        headerName: "Host",
        field: "host",
        cellClass: "log-cell",
        width: 86,
     };

    const pathCol = {
        headerName: "Path",
        field: "path",
        cellClass: "log-cell",
        cellRenderer: paramsToggle,
        maxWidth: isBig ? undefined : 308,
    };

    const userAgentCol = {
        headerName: "User Agent",
        field: "userAgent",
        cellClass: "log-cell",
    };

    if (isBig) {
        return [timestampCol, ipCol, statusCol, methodCol, tlsCol, pathCol, osCol, userAgentCol];
    } else {
        return [timestampCol, osCol, statusCol, methodCol, tlsCol, hostCol, pathCol, userAgentCol];
    }
}

function massageRow(row) {
    function shortenUserAgent(userAgent) {
        return userAgent.replace(/\(.*?\) */g, "");
    }

    const maxPathLength = IS_BIG ? 120 : 50;
    const timestampFormat = IS_BIG ? "%Y-%m-%d %H:%M:%S" : "%a %H:%M:%S";

    row.timestamp = strftime(new Date(row.timestamp), timestampFormat);
    row.os = IS_BIG ? row.os : { "Mac": "Mac", "Windows": "Win", "iPhone": "iOS", "Android": "And", "Linux": "*nix", "Spider": "Spdr","-": "-" }[row.os];
    row.httpMethod = IS_BIG ? row.httpMethod : row.httpMethod.substring(0, 4);
    row.tls = IS_BIG ? row.tls : row.tls.replace("TLSv", "");
    row.host = IS_BIG ? row.host : row.host.replace("aeromancer", "aero");
    row.path = row.path.length <= maxPathLength ? row.path : row.path.substring(0, maxPathLength - 1) + "&hellip;";
    row.userAgent = shortenUserAgent(row.userAgent);
}

const apiDatasource = {
    getRows: async (params) => {
        const filters = getFilterParams();
        const numRows = params.endRow - params.startRow;
        const url = `${API_ROOT}/requests?limit=${numRows}&offset=${params.startRow}&start=2020-01-01&${filters}`;

        let response;
        if (DEBUG) {
            response = generateRowData(numRows);
        } else {
            response = await getApiResponse(url);
        }

        let rows;
        if (!response || response.status !== "ok" || !response.result) {
            console.error("API error:", response);
            rows = [];
        } else {
            rows = response.result;
        }

        const rowsReturned = rows.length;

        for (let row of rows) {
            row = massageRow(row);
        }

        const totalRows = rowsReturned < numRows ? params.startRow + rowsReturned : -1;
        params.successCallback(rows, totalRows);
        if (params.context.options) {
            if (IS_BIG) {
                params.context.options.columnApi.autoSizeAllColumns();
            } else {
                params.context.options.columnApi.autoSizeColumns(["path", "userAgent"]);
            }
        }
    },
};

function getRowClassRule(key) {
    const ruleMap = new Map();
    ruleMap.set("self",    (data) => data.ip === "24.130.65.132");
    ruleMap.set("sketchy", (data) => data.os === "" || data.status === 444 || data.status === 404);
    ruleMap.set("info",    (data) => data.httpMethod === "HEAD" || data.httpMethod === "OPTIONS");
    ruleMap.set("api",     (data) => data.host.startsWith("api."));
    ruleMap.set("robots",  (data) => data.path === "/robots.txt");
    ruleMap.set("tls",     (data) => data.tls === "");
    ruleMap.set("spider",  (data) => data.os === "Spider");

    return (params) => {
        if (params.data === undefined) {
            return false;
        }
        for (let [ruleKey, ruleCondition] of ruleMap) {
            if (ruleCondition(params.data)) {
                return key === ruleKey;
            }
            if (key === ruleKey) {
                return false;
            }
        }
        return false;
    };
}

const gridOptions = {
    columnDefs: makeColumnDefs(IS_BIG),
    defaultColDef: {
        suppressMovable: true,
        headerClass: "header",
        suppressSizeToFit: true,
    },
    suppressCellFocus: true,
    rowClass: "log-row",
    rowHeight: IS_BIG ? 20 : 14,
    headerHeight: 30,
    suppressColumnVirtualisation: true,
    rowClassRules: {
        self: getRowClassRule("self"),
        api: getRowClassRule("api"),
        info: getRowClassRule("info"),
        tls: getRowClassRule("tls"),
        spider: getRowClassRule("spider"),
        robots: getRowClassRule("robots"),
        sketchy: getRowClassRule("sketchy"),
    },
    rowModelType: "infinite",
    datasource: apiDatasource,
};

function initGrid(elemId) {
    const gridElem = document.getElementById(elemId);
    gridOptions.context = { options: gridOptions };
    new agGrid.Grid(gridElem, gridOptions);
}



document.addEventListener("DOMContentLoaded", () => {
    const chart = createChart("display");
    setButtonHandlers(chart, gridOptions);
    initGrid("log-entries");

    chartCollapseSetup();

    showGraph(chart);


    window.addEventListener("resize", () => {
        let newIsBig = shouldBeBig();
        if (newIsBig != IS_BIG) {
            IS_BIG = newIsBig;
            gridOptions.api.setColumnDefs(makeColumnDefs(IS_BIG));
            gridOptions.columnApi.autoSizeAllColumns();
            gridOptions.rowHeight = IS_BIG ? 25 : 15
        }
    });
});
