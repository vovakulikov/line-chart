export const getDimension = (maxPoint, horizontalLines) => {
    return maxPoint / horizontalLines;
};

export const getZoomRatio = (chartHeight, maxPoint) => {
    return chartHeight / maxPoint;
};

export const getViewportX = (canvasWidth, viewportStart) => {
    return -(canvasWidth * viewportStart);
};

export const getLabelWidth = (text, fontSize) => {
    // TODO: check this function
    return Math.ceil(text.length * fontSize / 2);
};

export const formatDate = (ts) => {
    // TODO: refactor this (toLocaleString?)
    const date = new Date(ts);
    const month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const number = date.getDate() > 9 ? date.getDate() : `0${date.getDate()}`;
    return `${month_names_short[date.getMonth()]} ${number}`;
};

export const getWeekDay = (timestamp) => {
    const week_days_short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = new Date(timestamp);

    return week_days_short[date.getDay()];
};

export const calculateCanvasWidth = (containerWidth, {start, end}) => {
    return containerWidth / (end - start);
};

export const prepareChartData = (data) => data.columns
    .filter(c => c[0] !== 'x')
    .reduce((acc, c) => {
        const id = c[0];

        acc[id] = {
            id,
            dataPoints: c.slice(1),
            name: data.names[id],
            type: data.types[id],
            color: data.colors[id],
            displayState: {
                isDisplayed: true,
                isFading: false,
                isReappearing: false,
                opacity: 1.0,
            }
        };

        return acc;
    }, {});

export const prepareMinimapData = (data) => {
    return data.columns
        .filter(c => c[0] !== 'x')
        .map((column) => {
            const id = column[0];

            return {
                id,
                dataPoints: column.slice(1),
                color: data.colors[id],
                isDisplayed: true,
            };
        });
};

export const rafThrottle = function t(f, time) {
    var lastCallTime = performance.now();
    var lastArgs;
    var lastResult;
    var isFirst = true;

    return [function () {
        var actualTime = performance.now();
        lastArgs = arguments;

        if ((actualTime - lastCallTime) >= time || isFirst) {
            lastResult = f.apply(this, lastArgs);
            lastCallTime = actualTime;
            isFirst = false;
        }


        return lastResult;
    }, () => lastCallTime = 0]
}


export function hexToRGB(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    if (alpha) {
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    } else {
        return "rgb(" + r + ", " + g + ", " + b + ")";
    }
}
export const getCoords = (elem) => {
    const box = elem.getBoundingClientRect();

    return {
        top: box.top + pageYOffset,
        left: box.left + pageXOffset,
        right: box.right - pageXOffset,
        width: box.width,
        height: box.height,
    };
};

export const getTranslateValue = (transform) => {
    return +transform.replace(/[^\d.]/g, '');
};

export const isInRange = (value, min, max) => {
    return value >= min && value <= max;
};

export const updateViewport = (start, end, containerWidth) => {
    return {start: Math.max(0.0, start / containerWidth), end: Math.min(end / containerWidth, 1.0)};
};

export const getAbsoluteXCoordinate = (canvas, xCoord) => {
    // FIXME: add real padding & margin
    return +xCoord + +getTranslateValue(canvas.style.transform) - 49;
};

export const getRelativeXCoordinate = (canvas, xCoord) => {
    // FIXME: add real padding & margin
    return xCoord - getTranslateValue(canvas.style.transform) + 49;
};

export const getPointIndexFromCoordinate = (xCoord, step) => {
    return Math.round(xCoord / step) - 1;
};
