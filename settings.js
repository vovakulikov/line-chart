export default {
    initViewport: {
        start: 0.7,
        end: 1.0,
    },
    data: {
        xColumn: 'x',
    },
    grid: {
        font: 'Arial',
        fontSize: 18,
        xLineWidth: 1.0,
        yLineWidth: 0.5,
        strokeStyle: 'rgba(0, 0, 0, 0.16)',
        fillStyle: 'rgba(0, 0, 0, 0.4)',
        marginBetweenLabels: 40,
        labelsOffset: 40,
        sections: 6,
    },
    chart: {
        lineWidth: 3.0,
        dotRadius: 6.0,
        dotLineWidth: 6.0,
        backgroundColor: {
            default: '#ffffff',
            nightMode: '#000000',
        }

    },
    minimap: {
        minWidth: 40,
        offsetTop: 10,
    },
    animation: {
        elasticity: 0.008,
    }
}
