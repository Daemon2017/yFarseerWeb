const LAT_URL_PARAM = "lat";
const LNG_URL_PARAM = "lng";
const ZOOM_URL_PARAM = "zoom";
const ISEXTENDED_URL_PARAM = "isExtended";
const THRESHOLD_URL_PARAM = "threshold";
const SNPS_URL_PARAM = "snps";
const MODE_URL_PARAM = "mode";

const LAT_FORM_ELEMENT_ID = "latForm";
const LNG_FORM_ELEMENT_ID = "lngForm";
const EXTENDED_CHECKBOX_ELEMENT_ID = "extendedCheckbox";
const INTENSITY_SLIDER_ELEMENT_ID = "intensitySlider";
const SEARCH_FORM_ELEMENT_ID = "searchForm";
const CORRELATION_MATRIX_ELEMENT_ID = "correlationMatrix";
const STATE_LABEL_ELEMENT_ID = "stateLabel";
const BOXES_ELEMENT_ID = "boxes";

const BUSY_STATE_TEXT = "Busy...";
const OK_STATE_TEXT = "OK.";

const NO_SNP_WAS_SPECIFIED_ERROR_TEXT = "Error: No SNP was specified!";
const BOTH_LAT_AND_LNG_MUST_BE_A_NUMBER_ERROR_TEXT = "Error: Both Lat and Lng must be a number!";
const DATA_OF_ALL_SNPS_WASNT_RECEIVED_ERROR_TEXT = "Error: Data of all SNPs wasn't received!";

const colorBoxesNumber = 30;

let map;
let dbSnpsList = [];
let mode;
let gradientValues = [];
let uncheckedSnpsList = [];
let currentSnpList = [];
let haplotree = {};

const Mode = Object.freeze({
    LEVEL: String("levels"),
    DISPERSION: String("dispersion"),
    TRACE: String("trace"),
    CORRELATION_ALL: String("correlationAll"),
    CORRELATION_INTERSECT: String("correlationIntersect")
});

async function main() {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;

    gradientValues = createGradientList();

    let colorBoxesInnerHtml = ``;
    for (let i = 0; i < colorBoxesNumber; i++) {
        colorBoxesInnerHtml +=
            `<span class="colorBox tooltip" id="colorBox${i}">
            <input type="checkbox" class="checkBox" id="checkBox${i}" onclick="updateUncheckedList(${i})"/>
            <label class="checkBoxLabel" id="checkBoxLabel${i}" for="checkBox${i}"></label>
        </span>`;
    }
    document.getElementById(BOXES_ELEMENT_ID).innerHTML = colorBoxesInnerHtml;

    let queryString = window.location.search;
    let urlParams = new URLSearchParams(queryString);
    let lat = urlParams.get(LAT_URL_PARAM) == null ? 48.814170 : urlParams.get(LAT_URL_PARAM);
    document.getElementById(LAT_FORM_ELEMENT_ID).value = lat;
    let lng = urlParams.get(LNG_URL_PARAM) == null ? 23.169720 : urlParams.get(LNG_URL_PARAM);
    document.getElementById(LNG_FORM_ELEMENT_ID).value = lng;
    let zoom = urlParams.get(ZOOM_URL_PARAM) == null ? 4 : urlParams.get(ZOOM_URL_PARAM);
    document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked = urlParams.get(ISEXTENDED_URL_PARAM) == "true" ? true : false;
    document.getElementById(INTENSITY_SLIDER_ELEMENT_ID).value = urlParams.get(THRESHOLD_URL_PARAM) == null ? 5 : urlParams.get(THRESHOLD_URL_PARAM);
    let snpString = urlParams.get(SNPS_URL_PARAM);
    mode = urlParams.get(MODE_URL_PARAM);

    let baseLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://cloudmade.com">CloudMade</a>',
            maxZoom: 10,
        }
    );

    map = new L.Map("mapLayer", {
        center: new L.LatLng(lat, lng),
        zoom: zoom,
        layers: [baseLayer],
    });
    map.addEventListener("move", getLatLng());

    L.Control.FileLayerLoad.LABEL = '<img class="icon" src="./img/folder.svg" alt="file icon"/>';
    let lflControl = L.Control.fileLayerLoad({
        fitBounds: true,
        layer: L.geoJson,
        layerOptions: {
            style: {
                color: 'red',
                fillOpacity: 0.1
            }
        },
    });
    lflControl.addTo(map);

    dbSnpsList = await getDocFromDb(document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked ? "new_snps_extended" : "new_snps", "list");

    haplotree = await getCollectionFromDb("haplotree");

    attachDropDownPrompt();

    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;

    selectAction(snpString);
}

async function showMap(isDispersion, snpString) {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;

    if (isDispersion === true) {
        mode = Mode.DISPERSION;
    } else {
        mode = Mode.LEVEL;
    }

    clearAll(false);
    currentSnpList = getSnpListWithChecks(snpString);

    let threshold = 10 - document.getElementById(INTENSITY_SLIDER_ELEMENT_ID).value;
    drawLayers(currentSnpList, threshold);
}

async function showTrace(snpString) {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;

    mode = Mode.TRACE;

    clearAll(false);
    currentSnpList = getSnpListWithChecks(snpString);

    drawTrace(currentSnpList);
}

async function updateExtendedState() {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;
    dbSnpsList = await getDocFromDb(document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked ? "new_snps_extended" : "new_snps", "list");
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
}

function updateIntensity(intensity) {
    let threshold = 10 - intensity;
    drawLayers(currentSnpList, threshold);
}

function clearAll(isClearButtonPressed) {
    if (isClearButtonPressed) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;
        map = getMapWithoutUpperLayers();
    }
    for (let i = 0; i < colorBoxesNumber; i++) {
        document.getElementById(`checkBoxLabel${i}`).style = "background-color: transparent";
        document.getElementById(`checkBoxLabel${i}`).innerHTML = null;
        document.getElementById(`checkBox${i}`).checked = false;
    }
    uncheckedSnpsList = [];
    document.getElementById(CORRELATION_MATRIX_ELEMENT_ID).innerHTML = null;
    map = getMapWithoutHeatmapLayers();
    map = getMapWithoutPolylineLayers();
    map = getMapWithoutCircleLayers();
    if (isClearButtonPressed) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
    }
}

function setLatLng() {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;
    try {
        let lat = Number(document.getElementById(LAT_FORM_ELEMENT_ID).value);
        let lng = Number(document.getElementById(LNG_FORM_ELEMENT_ID).value);
        map.panTo(new L.LatLng(lat, lng));
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
    } catch (e) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BOTH_LAT_AND_LNG_MUST_BE_A_NUMBER_ERROR_TEXT;
        throw BOTH_LAT_AND_LNG_MUST_BE_A_NUMBER_ERROR_TEXT;
    }
}

function getLink() {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;
    let myUrl = new URL("https://daemon2017.github.io/yFarseerWeb/");
    myUrl.searchParams.append(LAT_URL_PARAM, map.getCenter().lat);
    myUrl.searchParams.append(LNG_URL_PARAM, map.getCenter().lng);
    myUrl.searchParams.append(ZOOM_URL_PARAM, map.getZoom());
    myUrl.searchParams.append(ISEXTENDED_URL_PARAM, document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked);
    myUrl.searchParams.append(THRESHOLD_URL_PARAM, document.getElementById(INTENSITY_SLIDER_ELEMENT_ID).value);
    myUrl.searchParams.append(SNPS_URL_PARAM, document.getElementById(SEARCH_FORM_ELEMENT_ID).value.replace(/ /g, ""));
    myUrl.searchParams.append(MODE_URL_PARAM, mode);

    window.prompt("Copy to clipboard: Ctrl+C, Enter", myUrl);
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
}

async function showCorrelation(isAll, snpString) {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;

    if (isAll) {
        mode = Mode.CORRELATION_ALL;
    } else {
        mode = Mode.CORRELATION_INTERSECT;
    }

    clearAll(false);
    currentSnpList = getSnpListWithChecks(snpString);

    let allSnpPointsList = [];
    if (currentSnpList !== undefined) {
        let errorSnpList = [];
        for (const snp of currentSnpList) {
            try {
                let data = await getDocFromDb(document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked ? "new_snps_extended" : "new_snps", snp);
                allSnpPointsList.push(data);
            } catch (e) {
                errorSnpList.push(snp);
            }
        }

        let correlationMatrix = getCorrelationMatrix(allSnpPointsList);

        let successSnpList = currentSnpList.filter(function (snp) {
            return !errorSnpList.includes(snp);
        });
        if (successSnpList.length > 0) {
            document.getElementById(CORRELATION_MATRIX_ELEMENT_ID).innerHTML = getHtmlTable(correlationMatrix, successSnpList);
            $("table").tablesort();
            $("thead th.amount").data("sortBy", function (_th, td, _tablesort) {
                return parseFloat(td.text());
            });
        }

        printSnpReceivingState(errorSnpList, currentSnpList);
    }
}

async function getParent() {
    let newSnpList = [];
    currentSnpList = getSnpList(null);
    for (const snp of currentSnpList) {
        for (const haplogroupId of Object.keys(haplotree)) {
            if (snp === haplotree[haplogroupId]['name']) {
                let parentId = haplotree[haplogroupId]['parentId'];
                let parentName = haplotree[parentId]['name'];
                newSnpList.push(parentName);
                break;
            }
        }
    }
    let newSnpString = Array.from(new Set(newSnpList)).join(",");
    if (mode === null) {
        document.getElementById(SEARCH_FORM_ELEMENT_ID).value = newSnpString;
    } else {
        selectAction(newSnpString);
    }
}