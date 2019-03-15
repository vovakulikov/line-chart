import {
    prepareChartData, formatDate, getLabelWidth, getZoomRatio, calculateCanvasWidth,
    getViewportX, isInRange, getDimension
} from './helpers.js';
import settings from "./settings.js";

export class Chart {
    constructor(canvas, chartContainer, legend, data, viewport$, displayedCharts$) {
        this.canvas = canvas;
        this.chartContainer = chartContainer;
        this.legend = legend;
        this.charts = prepareChartData(data);
        this.dates = data.columns.find(c => c[0] === 'x').slice(1);
        this.shouldUpdate = true;
        this.viewConfig = {
            labels: new Map(),
            zoomRatio: 1.0,
            isNightMode: false,
            isAnimating: false,
            animationConfig: {
                prevTs: null,
                delta: null,
            },
        };
        this.viewport$ = viewport$;
        this.displayedCharts$ = displayedCharts$;
        this.offsetLeft = getViewportX(this.canvas.width, this.viewport.start);

        this.viewport$.subscribe(() => {
            this.scrollToViewport();
            this.shouldUpdate = true;
        });

        this.displayedCharts$.subscribe(displayed => {
            Object.values(this.charts).forEach(chart => {
                chart.displayState.isDisplayed = displayed.has(chart.id);
            });

            this.shouldUpdate = true;
        });

        this.update = this.update.bind(this);

        const maxPoint = Math.max(...Object.values(this.charts).map(chart => Math.max(...chart.dataPoints)));

        this.viewConfig.zoomRatio = getZoomRatio(this.chartHeight, maxPoint);
    }

    get viewport() {
        return this.viewport$.value;
    }

    get chartHeight() {
        return this.canvas.height - settings.grid.labelsOffset;
    }

    init() {
        requestAnimationFrame(this.update);
        this.canvas.width = calculateCanvasWidth(this.chartContainer.clientWidth, this.viewport);
        this.addScrollingListeners();
        this.scrollToViewport();

        const legendButtons = this.makeLegendButtons();

        legendButtons.forEach(button => {
            this.legend.appendChild(button);
        });
    }

    // update cycle
    update(ts) {
        const _prevTs = this.viewConfig.animationConfig.prevTs || ts;

        this.viewConfig.animationConfig.prevTs = ts;
        this.viewConfig.animationConfig.delta = Math.min(100.0, ts - _prevTs);

        if (this.shouldUpdate) {
            this.canvas.width = calculateCanvasWidth(this.chartContainer.clientWidth, this.viewport);
            this.draw();
        }

        requestAnimationFrame(this.update);
    }

    draw() {
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const datesSpan = (this.dates[this.dates.length - 1] - this.dates[0]);
        const startDate = +this.dates[0] + Math.round(this.viewport.start * datesSpan);
        const dueDate = +this.dates[0] + Math.round(this.viewport.end * datesSpan);

        const displayedCharts = Object.values(this.charts)
            .filter(chart => chart.displayState.isDisplayed)
            .map(chart => chart.dataPoints);


        let maxPoint = Math.max(
            ...displayedCharts
                .map(points => Math.max(
                    ...points
                        .filter((_, index) => isInRange(this.dates[index], startDate, dueDate)))
                )
        );

        const zoomRatio = getZoomRatio(this.chartHeight, maxPoint);
        const p = settings.animation.elasticity * this.viewConfig.animationConfig.delta;
        const diff = zoomRatio - this.viewConfig.zoomRatio;

        this.viewConfig.zoomRatio = Math.abs(diff) < 0.00001  ? zoomRatio : this.viewConfig.zoomRatio + p * diff;

        this.drawGrid(ctx, zoomRatio);

        Object.keys(this.charts).forEach(id => {
            if (this.charts[id].displayState.isDisplayed) {
                this.drawChart(ctx, id);
            }
        });
    }

    drawGrid(ctx, lastZoomRatio) {
        const canvasWidth = this.canvas.width;
        const step = canvasWidth / (this.dates.length - 1);

        // styling
        ctx.strokeStyle = settings.grid.strokeStyle;
        ctx.lineWidth = settings.grid.yLineWidth;
        ctx.font = `${settings.grid.fontSize}px ${settings.grid.font}`;
        ctx.fillStyle = settings.grid.fillStyle;

        const labelsX = canvasWidth * this.viewport.start;

        const newMaxY = (this.chartHeight - settings.grid.labelsOffset) / lastZoomRatio;
        const dimension = getDimension(newMaxY, settings.grid.sections - 1);

        const newLabels = new Array(settings.grid.sections).fill(null).map((_, index) => ({
            targetOpacity: 1,
            opacity: 0,
            strokeOpacity: 0,
            targetStrokeOpacity: 1,
            value: dimension * index
        }));

        const delta = this.viewConfig.animationConfig.delta;
        const p = 0.009 * delta;
        const ps = 0.007 * delta;

        const labels = this.viewConfig.labels;

        [...labels.values()].forEach((label) => {
            label.targetOpacity = 0;
            label.targetStrokeOpacity = 0;

            return label;
        });

        newLabels.forEach((label) => {
            if (labels.has(label.value)) {
                labels.get(label.value).targetOpacity = 1;
                labels.get(label.value).targetStrokeOpacity = 1;
            } else {
                labels.set(label.value, label);
            }
        });


        // drawing
        // y-axis labels
        [...labels.values()].forEach((label) => {
            const height = this.chartHeight - Math.floor(this.viewConfig.zoomRatio * label.value);
            const diff = label.targetOpacity - label.opacity;
            const strokeDiff = label.targetStrokeOpacity - label.strokeOpacity;

            label.opacity += p * diff;
            label.strokeOpacity +=  ps * strokeDiff;

            ctx.save();

            ctx.beginPath();
            ctx.moveTo(0, height);
            ctx.lineTo(canvasWidth, height);
            ctx.fillStyle = `rgba(0,0,0, ${label.opacity})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${label.strokeOpacity})`;
            ctx.fillText(Math.round(label.value).toString(), labelsX, height - 6);
            ctx.stroke();

            ctx.restore();
        });

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

                ctx.beginPath();
                ctx.moveTo(step * i, this.chartHeight);
                ctx.stroke();

                ctx.fillText(label, x, this.chartHeight + 20);
                ctx.restore();

                previousLabelEnd = x + labelWidth;
            }
        }
    }

    drawChart(ctx, id) {
        const chart = this.charts[id];
        const dataPoints = chart.dataPoints;
        const step = this.canvas.width / (this.dates.length - 1);

        // styling
        ctx.lineWidth = settings.chart.lineWidth;

        let curX = 0;
        let curY = this.chartHeight - dataPoints[0] * this.viewConfig.zoomRatio;

        // drawing
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(curX, curY);
        ctx.strokeStyle = chart.color;

        for (let i = 1; i < dataPoints.length; i++) {
            curX += step;
            curY = this.chartHeight - dataPoints[i] * this.viewConfig.zoomRatio;
            ctx.lineTo(curX, curY);
        }

        ctx.stroke();
        ctx.restore();
    }

    scrollToViewport() {
        const {start, end} = this.viewport;

        this.canvas.width = calculateCanvasWidth(this.chartContainer.clientWidth, {start, end});
        this.offsetLeft = getViewportX(this.canvas.width, start);
        this.canvas.style.transform = `matrix(1, 0, 0, 1, ${this.offsetLeft}, 0)`;
    }

    addScrollingListeners() {
        // scrolling
        let isDragging = false;
        let lastX = 0;

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
                this.offsetLeft = Math.max(
                    -(this.canvas.width - this.chartContainer.clientWidth),
                    Math.min(this.offsetLeft + delta, 0)
                );

                this.canvas.style.transform = `matrix(1, 0, 0, 1, ${this.offsetLeft}, 0)`;

                const viewportOffset = Math.abs(this.offsetLeft / this.canvas.width);
                const viewportWidth = this.viewport.end - this.viewport.start;

                const start = viewportOffset;
                const end = Math.min(viewportOffset + viewportWidth, 1);

                this.viewport$.addEvent({start, end});
                this.shouldUpdate = true;
            }

            event.preventDefault();
        });

        window.addEventListener('touchend', () => {
            isDragging = false;
        });
    };

    makeLegendButtons = () => {
        return Object.values(this.charts).map(({id, name, color}) => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;

            checkbox.addEventListener('change', () => {
                const chart = this.charts[id];

                chart.displayState.isDisplayed = !chart.displayState.isDisplayed;

                const displayedChartsIds = Object.values(this.charts)
                    .filter(chart => chart.displayState.isDisplayed)
                    .map(({id}) => id);

                this.displayedCharts$.addEvent(new Set(displayedChartsIds));
                this.viewConfig.isAnimating = true;
                this.shouldUpdate = true;
            });

            return this.wrapLegendButton(checkbox, name, color);
        });
    };

    wrapLegendButton = (checkbox, labelText, color) => {
        const button = document.createElement('label');
        const text = document.createTextNode(labelText);
        const checkboxLabel = document.createElement('span');
        const checkboxBadge = document.createElement('span');

        button.classList.add('chart-legend__button', 'legend-button');
        button.style.color = color;
        checkbox.classList.add('legend-button__checkbox-input');
        checkboxLabel.classList.add('legend-button__text');
        checkboxBadge.classList.add('legend-button__checkbox-badge');

        checkboxLabel.appendChild(text);
        button.appendChild(checkbox);
        button.appendChild(checkboxBadge);
        button.appendChild(checkboxLabel);

        return button;
    };
}
