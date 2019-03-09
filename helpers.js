export const getDimension = (maxPoint, horizontalLines) => {
    const step = Math.ceil(maxPoint / horizontalLines);

    // TODO: allow infinitely big numbers
    return step;
};

export const getMultiplier = (chartHeight, maxPoint) => {
    return Math.floor(chartHeight / maxPoint);
};

