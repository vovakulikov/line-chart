export const getDimension = (maxPoint, horizontalLines) => {
    const step = Math.ceil(maxPoint / horizontalLines);

    // TODO: add rounding to beautiful numbers (5, 10, 100, etc.)
    return step;
};

export const getZoomRatio = (chartHeight, maxPoint) => {
    return chartHeight / maxPoint;
};

export const getViewportX = (canvasWidth, viewportStart) => {
    return -(canvasWidth * viewportStart);
};

export const getLabelWidth = (text, fontSize) => {
    // TODO: check this function
    return text.length * fontSize / 2;
};

export const formatDate = (timestamp) => {
    // TODO: refactor this (toLocaleString?)
    const month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const date = new Date(timestamp);

    return `${month_names_short[date.getMonth()]} ${date.getDate()}`;
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
