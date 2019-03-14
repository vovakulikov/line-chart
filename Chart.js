import {prepareChartData, formatDate, getLabelWidth, getZoomRatio, calculateCanvasWidth, getViewportX} from './helpers.js';
import settings from "./settings.js";

export class Chart {
    constructor(canvas, chartContainer, data) {
        this.canvas = canvas;
        this.chartContainer = chartContainer;
        this.charts = prepareChartData(data);
        this.dates = data.columns.find(c => c[0] === 'x').slice(1);
        this.shouldUpdate = true;
        this.viewConfig = {
            viewport: {
                start: 0.7,
                end: 1.0,
            },
            zoomRatio: 1.0,
            isNightMode: false,
            isAnimating: false,
            animationConfig: {
                duration: 200, // ms
                animationStep: null, // шаг изменения zoomRatio на каждый тик
                zoomRatioToReach: 1.0, // до какого зума перерисовываем
                transformFn: x => x,
            },
        };

        this.update = this.update.bind(this);

        const maxPoint = Math.max(...Object.values(this.charts).map(chart => Math.max(...chart.dataPoints)));
        const chartHeight = this.canvas.height - settings.grid.labelsOffset;

        this.viewConfig.zoomRatio = getZoomRatio(chartHeight, maxPoint);
        this.dimension = maxPoint / settings.grid.horizontalLines;
    }

    init() {
        requestAnimationFrame(this.update);
        this.canvas.width = calculateCanvasWidth(this.chartContainer.clientWidth, this.viewConfig.viewport);
        this.addScrollingListeners();
        this.scrollToViewport();
    }

    // update cycle
    update() {
        if (this.shouldUpdate) {
            this.canvas.width = calculateCanvasWidth(this.chartContainer.clientWidth, this.viewConfig.viewport);
            this.draw();
        }

        requestAnimationFrame(this.update);
    }

    draw() {
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid(ctx);
        Object.keys(this.charts).forEach(id => {
            this.drawChart(ctx, id);
        })
    }

    drawGrid(ctx) {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const step = canvasWidth / (this.dates.length - 1);

        // styling
        ctx.strokeStyle = settings.grid.strokeStyle;
        ctx.lineWidth = settings.grid.yLineWidth;
        ctx.font = `${settings.grid.fontSize}px ${settings.grid.font}`;
        ctx.fillStyle = settings.grid.fillStyle;

        const verticalLineStep = Math.floor(canvasHeight / 6);
        const chartHeight = canvasHeight - settings.grid.labelsOffset;
        const {viewport} = this.viewConfig;
        const labelsX = canvasWidth * viewport.start;

        // drawing
        // y-axis labels
        for (let i = 0; i < 6; i++) {
            const height = Math.ceil(chartHeight - i * verticalLineStep);

            ctx.save();

            ctx.beginPath();
            ctx.moveTo(0, height);
            ctx.lineTo(canvasWidth, height);
            ctx.fillText(this.dimension * i, labelsX, height - 6);
            ctx.stroke();

            ctx.restore();
        }

        ctx.lineWidth = settings.grid.xLineWidth;

        // x-axis labels
        let previousLabelEnd = 0;
        for (let i = 0; i < this.dates.length; i++) {
            const label = formatDate(this.dates[i]);
            const labelWidth = getLabelWidth(label, settings.grid.fontSize);
            const margin = settings.grid.marginBetweenLabels;
            let x;

            if (i === 0) {
                x = 0;
            } else if (i === this.dates.length - 1) {
                x = step * i - labelWidth;
            } else {
                x = step * i - labelWidth / 2;
            }

            if (i === 0 || i === this.dates.length - 1 ||
                (x > previousLabelEnd + margin && x < canvasWidth - labelWidth - margin)) {
                ctx.save();

                // TODO: remove vertical lines
                ctx.beginPath();
                ctx.moveTo(step * i, chartHeight);
                ctx.lineTo(step * i, 0);
                ctx.stroke();

                ctx.fillText(label, x, chartHeight + 20);
                ctx.restore();

                previousLabelEnd = x + labelWidth;
            }
        }
    }

    drawChart(ctx, id) {
        const chartHeight = this.canvas.height - settings.grid.labelsOffset;
        const chart = this.charts[id];
        const dataPoints = chart.dataPoints;
        const step = this.canvas.width / (this.dates.length - 1);

        // styling
        ctx.lineWidth = settings.chart.lineWidth;

        let curX = 0;
        let curY = chartHeight - dataPoints[0] * this.viewConfig.zoomRatio;

        // drawing
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(curX, curY);
        ctx.strokeStyle = chart.color;

        for (let i = 1; i < dataPoints.length; i++) {
            curX += step;
            curY = chartHeight - dataPoints[i] * this.viewConfig.zoomRatio;
            ctx.lineTo(curX, curY);
        }

        ctx.stroke();
        ctx.restore();
    }

    updateViewport(start, width) {
        const containerWidth = this.chartContainer.clientWidth;
        const viewportStart = start / containerWidth;
        const viewportWidth = width / containerWidth;
        const viewport = this.viewConfig.viewport;

        viewport.start = viewportStart;
        viewport.end = Math.min(viewportStart + viewportWidth, 1);

        this.shouldUpdate = true;

        this.scrollToViewport();
    }

    scrollToViewport() {
        const viewport = this.viewConfig.viewport;
        const {start, end} = viewport;

        this.canvas.width = calculateCanvasWidth(this.chartContainer.clientWidth, {start, end});
        this.canvas.style.transform = `translateX(${getViewportX(this.canvas.width, start)}px)`;
    }

    addScrollingListeners() {
        // scrolling
        let isDragging = false;
        let lastX = 0;
        let offsetLeft = getViewportX(this.canvas.width, this.viewConfig.viewport.start);

        this.canvas.addEventListener('touchstart', event => {
            isDragging = true;
            lastX = event.touches[0].clientX;
            event.preventDefault();
        });

        this.canvas.addEventListener('touchmove', event => {
            if (isDragging) {
                const x = event.touches[0].clientX;
                const delta = x - lastX;

                lastX = x;
                offsetLeft = Math.max(-(this.canvas.width - this.chartContainer.clientWidth), Math.min(offsetLeft + delta, 0));

                this.canvas.style.transform = `translateX(${offsetLeft}px)`;

                const viewportOffset = Math.abs(offsetLeft / this.canvas.width);
                const viewportWidth = this.viewConfig.viewport.end - this.viewConfig.viewport.start;

                this.viewConfig.viewport.start = viewportOffset;
                this.viewConfig.viewport.end = Math.min(viewportOffset + viewportWidth, 1);
                this.shouldUpdate = true;
            }

            event.preventDefault();
        });

        window.addEventListener('touchend', () => {
            isDragging = false;
        });
    };
}
