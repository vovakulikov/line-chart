export const getDimension = (maxPoint, horizontalLines) => {
    const step = Math.ceil(maxPoint / horizontalLines);

    // TODO: add rounding to beautiful numbers (5, 10, 100, etc.)
    return step;
};

export const getMultiplier = (chartHeight, maxPoint) => {
    return Math.floor(chartHeight / maxPoint);
};

export const getLabelWidth = (text, fontSize) => {
    return text.length * fontSize / 2;
};

export const formatDate = (date) => {
    const month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${month_names_short[date.getMonth()]} ${date.getDate()}`;
};

