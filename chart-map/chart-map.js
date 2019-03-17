import {updateViewConfig} from "../telegram_chart.js";

const chartData = [
    {
        points: [
            { x: 10, y: 10 },
            { x: 12, y: 15 },
            { x: 14, y: 43 },
            { x: 20, y: 43 },
            { x: 24, y: 66 },
            { x: 26, y: 100 },
            { x: 30, y: 66 },
            { x: 33, y: 93 },
            { x: 36, y: 75 },
            { x: 38, y: 88 },
            { x: 40, y: 28 },
            { x: 42, y: 36 },
            { x: 44, y: 44 },
            { x: 46, y: 56 },
            { x: 48, y: 88 },
        ],
        color: 'green',
    },
    {
        points: [
            { x: 10, y: 88 },
            { x: 12, y: 77 },
            { x: 14, y: 45 },
            { x: 20, y: 33 },
            { x: 24, y: 67 },
            { x: 26, y: 22 },
            { x: 30, y: 56 },
            { x: 33, y: 76 },
            { x: 36, y: 55 },
            { x: 39, y: 34 },
            { x: 42, y: 89 },
            { x: 45, y: 80 },
            { x: 48, y: 50 },
        ],
        color: 'red',
    },
];

const canvas = document.querySelector('.mini-map');
const { width, height } = canvas;
const ctx = canvas.getContext('2d');
const MIN_WIDTH_VIEWPORT = 40;

function getMax(getProp) {

    return Math.max(
        ...chartData
            .map(chart => Math.max(...chart.points.map(getProp)))
    );
}

function getMin(getProp) {

    return Math.min(
        ...chartData
            .map(chart => Math.min(...chart.points.map(getProp)))
    );
}

const maxX = getMax((point) => point.x);
const minX = getMin((point) => point.x);
const maxY = getMax((point) => point.y);
const minY = getMin((point) => point.y);

const ratioY = height / maxY;
const ratioX = width / (maxX - minX);


console.log(minX, maxX, minY, maxY);

function drawChart(ctx, { canvasHeight, ratioY, ratioX, dataset }) {
    const { points, color } = dataset;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.strokeStyle = color;

    for (let i = 0; i < points.length; i++) {
        const y = height -  points[i].y * ratioY;
        const x = points[i].x * ratioX - minX * ratioX;

        ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
}

drawChart(ctx, {dataset: chartData[0], canvasHeight: height, ratioY, ratioX});
drawChart(ctx, {dataset: chartData[1], canvasHeight: height, ratioY, ratioX});


// Это все нужно будет исправить!!!!!
const slider = document.querySelector('.slider');
const wrap = document.querySelector('.mini-map__wrapper');
const touchContainer = document.querySelector('.map__touch-container');
let animationTimer;

slider.addEventListener('touchstart', (event) => {
    const wrapCoords = getCoords(wrap);
    const coords = getCoords(event.target);
    event = event.touches[0];

    const startX = coords.left - wrapCoords.left;
    const originEventX = event.pageX;
    const originEventY = event.pageY - wrapCoords.top;
    const leftShift = event.pageX - coords.left;
    const rightShift = coords.right - event.pageX;

    touchContainer.style.transform = `translate(${originEventX - wrapCoords.left}px, ${originEventY}px)`;
    touchContainer.classList.add('map__touch-container__is-visible');
    clearTimeout(animationTimer);

    function move(event) {
        event.stopImmediatePropagation();
        event = event.touches[0];

        const delta = event.pageX - originEventX;

        if (event.pageX >= wrapCoords.left && event.pageX <= wrapCoords.right) {
            touchContainer.style.transform = `translate(${event.pageX - wrapCoords.left}px, ${originEventY}px)`;
        }

        if ((event.pageX - leftShift) < wrapCoords.left) {
            slider.style.transform =`translateX(${0}px)`;
            updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

            return;
        }

        if ((event.pageX + rightShift) > wrapCoords.right ){
            slider.style.transform =`translateX(${wrapCoords.width - coords.width}px)`;
            updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

            return;
        }

        slider.style.transform =`translateX(${startX + delta}px)`;
        updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);
    }

    function cleanUp() {
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', cleanUp);

        touchContainer.classList.remove('map__touch-container__is-visible');
        animationTimer = setTimeout(() => touchContainer.style.transform = ``, 200);
    }

    document.addEventListener('touchmove', move);
    document.addEventListener('touchend', cleanUp);
});

const leftHand = document.querySelector('.left_hand');
const rightHand = document.querySelector('.right_hand');

rightHand.addEventListener('touchstart', (event) => {
    event.stopImmediatePropagation();
    event = event.touches[0];

    const wrapCoords = getCoords(wrap);
    const sliderCoords = getCoords(slider);
    const originEventX = event.pageX;
    const originEventY = event.pageY - wrapCoords.top;
    const originWidth = slider.clientWidth;

    touchContainer.style.transform = `translate(${originEventX - wrapCoords.left}px, ${originEventY}px)`;
    touchContainer.classList.add('map__touch-container__is-visible');
    clearTimeout(animationTimer);

    function changeWidth(event) {
        event.stopImmediatePropagation();
        event = event.touches[0];

        const delta = event.pageX - originEventX;
        const newWidth = originWidth + delta;

        if (newWidth < MIN_WIDTH_VIEWPORT) {
            slider.style.width = `${MIN_WIDTH_VIEWPORT}px`;
            updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

            return;
        }

        if (event.pageX >= wrapCoords.left && event.pageX <= wrapCoords.right) {
            touchContainer.style.transform = `translate(${event.pageX - wrapCoords.left}px, ${originEventY}px)`;
        }

        if ((newWidth + (sliderCoords.left - wrapCoords.left)) >= (wrapCoords.right - wrapCoords.left)) {
            slider.style.width = `${wrapCoords.right - sliderCoords.left}px`;
            updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

            return;
        }

        slider.style.width = `${originWidth + delta}px`;
        updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);
    }

    function cleanUp() {
        document.removeEventListener('touchmove', changeWidth);
        document.removeEventListener('touchend', cleanUp);

        touchContainer.classList.remove('map__touch-container__is-visible');
        animationTimer = setTimeout(() => touchContainer.style.transform = ``, 200);
    }

    document.addEventListener('touchmove', changeWidth);
    document.addEventListener('touchend', cleanUp);
});

leftHand.addEventListener('touchstart', (event) => {
    event.stopImmediatePropagation();
    event = event.touches[0];

    const wrapCoords = getCoords(wrap);
    const sliderCoords = getCoords(slider);

    const startX = sliderCoords.left - wrapCoords.left;
    const originEventX = event.pageX;
    const originEventY = event.pageY - wrapCoords.top;
    const originWidth = slider.clientWidth;
    const leftShiftX = event.pageX - sliderCoords.left;

    touchContainer.style.transform = `translate(${originEventX - wrapCoords.left}px, ${originEventY}px)`;
    touchContainer.classList.add('map__touch-container__is-visible');
    clearTimeout(animationTimer);


    function changeWidth(event) {
        event.stopImmediatePropagation();
        event = event.touches[0];

        const delta = event.pageX - originEventX;
        const newWidth = originWidth + -1 * delta;

        if (newWidth < MIN_WIDTH_VIEWPORT) {
            slider.style.width = `${MIN_WIDTH_VIEWPORT}px`;
            slider.style.transform =`translateX(${sliderCoords.right - wrapCoords.left - MIN_WIDTH_VIEWPORT}px)`;
            updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

            return;
        }

        if (event.pageX >= wrapCoords.left && event.pageX <= wrapCoords.right) {
            touchContainer.style.transform = `translate(${event.pageX - wrapCoords.left}px, ${originEventY}px)`;
        }

        if ((event.pageX - leftShiftX) <= wrapCoords.left) {
            slider.style.width = `${sliderCoords.right - wrapCoords.left}px`;
            slider.style.transform =`translateX(0px)`;
            updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

            return;
        }

        slider.style.transform =`translateX(${startX + delta}px)`;
        slider.style.width = `${newWidth}px`;
        updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);
    }

    function cleanUp() {
        document.removeEventListener('touchmove', changeWidth);
        document.removeEventListener('touchend', cleanUp);

        touchContainer.classList.remove('map__touch-container__is-visible');
        animationTimer = setTimeout(() => touchContainer.style.transform = ``, 200);
    }

    document.addEventListener('touchmove', changeWidth);
    document.addEventListener('touchend', cleanUp);
});

function getCoords(elem) {
    const  box = elem.getBoundingClientRect();

    return {
        top: box.top + pageYOffset,
        left: box.left + pageXOffset,
        right: box.right - pageXOffset,
        width: box.width,
        height: box.height,
    };
}

function getTranslateValue(transform) {
    return +transform.replace(/[^\d.]/g, '');
}
