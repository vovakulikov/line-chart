import settings from "./settings.js";
import {getCoords, getTranslateValue, prepareMinimapData, updateViewport} from './helpers.js';

export class ChartMap {
    constructor(canvas, data, viewport$, displayedCharts$) {
        this.canvas = canvas;
        this.chartData = prepareMinimapData(data);
        this.zoomRatio = 1.0;
        this.slider = document.querySelector('.slider');
        this.viewport$ = viewport$;
        this.displayedCharts$ = displayedCharts$;

        this.viewport$.subscribe(() => {
            this.scrollToViewport();
        });

        this.displayedCharts$.subscribe(displayed => {
            this.chartData.forEach(chart => {
                chart.isDisplayed = displayed.has(chart.id);
            });
            this.update();
        });
    }

    get viewport() {
        return this.viewport$.value;
    }

    get chartHeight() {
        return this.canvas.height;
    }

    get chartWidth() {
        return this.canvas.width;
    }

    init() {
        this.update();

        // Это все нужно будет исправить!!!!!
        const wrap = document.querySelector('.mini-map__wrapper');
        const touchContainer = document.querySelector('.map__touch-container');
        let animationTimer;

        this.slider.addEventListener('touchstart', (event) => {
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

            const that = this;

            function move(event) {
                event.stopImmediatePropagation();
                event = event.touches[0];

                const delta = event.pageX - originEventX;

                if (event.pageX >= wrapCoords.left && event.pageX <= wrapCoords.right) {
                    touchContainer.style.transform = `translate(${event.pageX - wrapCoords.left}px, ${originEventY}px)`;
                }

                if ((event.pageX - leftShift) < wrapCoords.left) {
                    that.slider.style.transform =`translateX(${0}px)`;

                    return;
                }

                if ((event.pageX + rightShift) > wrapCoords.right ){
                    that.slider.style.transform =`translateX(${wrapCoords.width - coords.width}px)`;

                    return;
                }

                that.slider.style.transform =`translateX(${startX + delta}px)`;

                const start = getTranslateValue(that.slider.style.transform);
                const end = start + that.slider.clientWidth;

                that.viewport$.addEvent(updateViewport(start, end, that.chartWidth));
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
            const sliderCoords = getCoords(this.slider);
            const originEventX = event.pageX;
            const originEventY = event.pageY - wrapCoords.top;
            const originWidth = this.slider.clientWidth;

            touchContainer.style.transform = `translate(${originEventX - wrapCoords.left}px, ${originEventY}px)`;
            touchContainer.classList.add('map__touch-container__is-visible');
            clearTimeout(animationTimer);

            const that = this;

            function changeWidth(event) {
                event.stopImmediatePropagation();
                event = event.touches[0];

                const delta = event.pageX - originEventX;
                const newWidth = originWidth + delta;

                if (newWidth < settings.minimap.minWidth) {
                    that.slider.style.width = `${settings.minimap.minWidth}px`;

                    return;
                }

                if (event.pageX >= wrapCoords.left && event.pageX <= wrapCoords.right) {
                    touchContainer.style.transform = `translate(${event.pageX - wrapCoords.left}px, ${originEventY}px)`;
                }

                if ((newWidth + (sliderCoords.left - wrapCoords.left)) >= (wrapCoords.right - wrapCoords.left)) {
                    that.slider.style.width = `${wrapCoords.right - sliderCoords.left}px`;

                    return;
                }

                that.slider.style.width = `${originWidth + delta}px`;

                const start = getTranslateValue(that.slider.style.transform);
                const end = start + that.slider.clientWidth;

                that.viewport$.addEvent(updateViewport(start, end, that.chartWidth));
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
            const sliderCoords = getCoords(this.slider);

            const startX = sliderCoords.left - wrapCoords.left;
            const originEventX = event.pageX;
            const originEventY = event.pageY - wrapCoords.top;
            const originWidth = this.slider.clientWidth;
            const leftShiftX = event.pageX - sliderCoords.left;

            touchContainer.style.transform = `translate(${originEventX - wrapCoords.left}px, ${originEventY}px)`;
            touchContainer.classList.add('map__touch-container__is-visible');
            clearTimeout(animationTimer);

            const that = this;

            function changeWidth(event) {
                event.stopImmediatePropagation();
                event = event.touches[0];

                const delta = event.pageX - originEventX;
                const newWidth = originWidth + -1 * delta;

                if (newWidth < settings.minimap.minWidth) {
                    that.slider.style.width = `${settings.minimap.minWidth}px`;
                    that.slider.style.transform =`translateX(${sliderCoords.right - wrapCoords.left - settings.minimap.minWidth}px)`;

                    return;
                }

                if (event.pageX >= wrapCoords.left && event.pageX <= wrapCoords.right) {
                    touchContainer.style.transform = `translate(${event.pageX - wrapCoords.left}px, ${originEventY}px)`;
                }

                if ((event.pageX - leftShiftX) <= wrapCoords.left) {
                    that.slider.style.width = `${sliderCoords.right - wrapCoords.left}px`;
                    that.slider.style.transform =`translateX(0px)`;

                    return;
                }

                that.slider.style.transform =`translateX(${startX + delta}px)`;
                that.slider.style.width = `${newWidth}px`;

                const start = getTranslateValue(that.slider.style.transform);
                const end = start + that.slider.clientWidth;

                that.viewport$.addEvent(updateViewport(start, end, that.chartWidth));
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
    }

    update() {
        const ctx = this.canvas.getContext('2d');

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const maxPoint = Math.max(...this.chartData.map(chart => Math.max(...chart.dataPoints)));

        this.zoomRatio = (this.chartHeight - settings.minimap.offsetTop) / maxPoint;

        const displayedCharts = this.chartData.filter(chart => chart.isDisplayed);

        displayedCharts.forEach(chart => {
            this.drawChart(ctx, {dataset: chart});
        });
    }

    drawChart(ctx, { dataset }) {
        const { dataPoints, color } = dataset;
        const step = this.chartWidth / dataPoints.length;

        ctx.save();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.strokeStyle = color;

        for (let i = 0; i < dataPoints.length; i++) {
            const y = this.chartHeight - dataPoints[i] * this.zoomRatio;
            const x = step * i;

            ctx.lineTo(x, y);
        }

        ctx.stroke();
        ctx.restore();
    }

    scrollToViewport() {
        this.slider.style.transform =`translateX(${this.viewport.start * this.canvas.width}px)`;
    }
}
