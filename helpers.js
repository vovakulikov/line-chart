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

export const formatDate = (date) => {
    // TODO: refactor this (toLocaleString?)
    const month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${month_names_short[date.getMonth()]} ${date.getDate()}`;
};

export const calculateCanvasWidth = (containerWidth, {start, end}) => {
    return containerWidth / (end - start);
};

export const scrollToViewport = (canvas, containerWidth, {start, end}) => {
    canvas.width = calculateCanvasWidth(containerWidth, {start, end});
    canvas.style.transform = `translateX(${getViewportX(canvas.width, start)}px)`;
};

