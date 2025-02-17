// charts.js

function renderPostStatsChart(postStats) {
    if (postStatsChart) {
        postStatsChart.dispose();
    }
    postStatsChart = echarts.init(document.getElementById('post-stats-chart'));
    postStatsChart.resize({ height: 400 });

    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'horizontal',
            left: 'left',
            top: 'top',
            data: ['Likes', 'Reposts', 'Replies', 'Quotes']
        },
        series: [
            {
                name: 'Post Stats',
                type: 'pie',
                radius: ['30%', '70%'],
                center: ['55%', '50%'], // Adjust center for better legend spacing
                startAngle: 180, // Start from left
                endAngle: 360, // Half-circle effect
                avoidLabelOverlap: true,
                label: {
                    show: true,
                    position: 'outside',
                    alignTo: 'edge',
                    margin: 20,
                    formatter: '{b|{b}}\n{per|{d}%}',
                    rich: {
                        b: {
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: '#2c3e50'
                        },
                        per: {
                            fontSize: 11,
                            color: '#666',
                            padding: [2, 0]
                        }
                    }
                },
                emphasis: {
                    scale: true,
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold'
                    },
                    itemStyle: {
                        shadowColor: 'rgba(0,0,0,0.3)',
                        shadowBlur: 20,
                        shadowOffsetY: 10
                    }
                },
                labelLine: {
                    show: true
                },
                data: [
                    { value: postStats.likeCount, name: 'Likes', itemStyle: { color: '#f64b7c' } },       // Blue
                    { value: postStats.repostCount, name: 'Reposts', itemStyle: { color: '#45ED9F' } },   // Green
                    { value: postStats.replyCount, name: 'Replies', itemStyle: { color: '#7148FC' } },    // Yellow
                    { value: postStats.quoteCount, name: 'Quotes', itemStyle: { color: '#0866ff' } }      // Red
                ]
            }
        ]
    };

    postStatsChart.setOption(option);
}


function renderInteractionTimelineChart(timelineData, postCreatedAt) {
    const timelineChart = echarts.init(document.getElementById('interaction-timeline-chart'));
    timelineChart.resize({ height: 400 });

    // Sort all interactions by timestamp
    const allInteractions = [
        ...timelineData.likes.map(d => ({ ...d, count: 1 })),
        ...timelineData.quotes.map(d => ({ ...d, count: 1 })),
        ...timelineData.replies.map(d => ({ ...d, count: 1 }))
    ].sort((a, b) => a.timestamp - b.timestamp);

    // Calculate cumulative counts
    const series = {
        likes: [],
        quotes: [],
        replies: []
    };

    let likeCount = 0, quoteCount = 0, replyCount = 0;
    allInteractions.forEach(interaction => {
        if (interaction.type === 'Like') likeCount++;
        if (interaction.type === 'Quote') quoteCount++;
        if (interaction.type === 'Reply') replyCount++;

        series.likes.push([interaction.timestamp, likeCount]);
        series.quotes.push([interaction.timestamp, quoteCount]);
        series.replies.push([interaction.timestamp, replyCount]);
    });

    const option = {
        tooltip: {
            trigger: 'axis',
            formatter: function (params) {
                const date = new Date(params[0]?.value[0]); // Use optional chaining
                const likes = params[0]?.value[1] || 0; // Default to 0 if undefined
                const quotes = params[1]?.value[1] || 0; // Default to 0 if undefined
                const replies = params[2]?.value[1] || 0; // Default to 0 if undefined

                return `${formatDate(date)}<br/>
                    Likes: ${likes}<br/>
                    Quotes: ${quotes}<br/>
                    Replies: ${replies}`;
            }
        },
        legend: {
            orient: 'horizontal',
            left: 'left',
            top: 'top',
            data: ['Likes', 'Quotes', 'Replies']
        },
        xAxis: {
            type: 'time',
            boundaryGap: false,
        },
        yAxis: {
            type: 'value',
            name: 'Count',
        },
        series: [
            {
                name: 'Likes',
                type: 'line',
                data: series.likes,
                smooth: true,
                lineStyle: { width: 2, color: '#f64b7c' },
                itemStyle: { color: '#f64b7c' },
                symbol: 'none'
            },
            {
                name: 'Quotes',
                type: 'line',
                data: series.quotes,
                smooth: true,
                lineStyle: { width: 2, color: '#0866ff' },
                itemStyle: { color: '#0866ff' },
                symbol: 'none'
            },
            {
                name: 'Replies',
                type: 'line',
                data: series.replies,
                smooth: true,
                lineStyle: { width: 2, color: '#7148FC' },
                itemStyle: { color: '#7148FC' },
                symbol: 'none'
            }
        ],
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: 100
            },
            {
                show: true,
                type: 'slider',
                bottom: 10,
                start: 0,
                end: 100
            }
        ]
    };

    timelineChart.setOption(option);
}