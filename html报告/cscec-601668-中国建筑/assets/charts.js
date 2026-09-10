(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var red = style.getPropertyValue('--red').trim();
  var green = style.getPropertyValue('--green').trim();

  // --- Chart: Revenue & Net Profit Trend ---
  var chart1 = echarts.init(document.getElementById('chart-revenue'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true },
    legend: {
      data: ['营收(亿)', '归母净利(亿)'],
      bottom: 0,
      textStyle: { color: ink, fontSize: 12 }
    },
    grid: { left: '12%', right: '8%', top: '8%', bottom: '14%' },
    xAxis: {
      type: 'category',
      data: ['2024', '2025Q1', '2025H1', '2025Q3', '2025', '2026Q1'],
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '营收(亿)',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: { color: muted, fontSize: 11, formatter: function(v) { return (v/10000).toFixed(1) + '万亿'; } },
        splitLine: { lineStyle: { color: rule } },
        axisLine: { show: false }
      },
      {
        type: 'value',
        name: '净利(亿)',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { show: false },
        axisLine: { show: false }
      }
    ],
    series: [
      {
        name: '营收(亿)',
        type: 'bar',
        data: [21871, 5553, 11083, 15582, 20821, 5118],
        itemStyle: { color: accent + '99' },
        barWidth: '50%',
        emphasis: { itemStyle: { color: accent } }
      },
      {
        name: '归母净利(亿)',
        type: 'line',
        yAxisIndex: 1,
        data: [461.87, 150.13, 304.04, 381.82, 390.69, 138.81],
        lineStyle: { color: accent2, width: 2.5 },
        itemStyle: { color: accent2 },
        symbol: 'circle',
        symbolSize: 6,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: accent2,
          formatter: function(p) { return p.value.toFixed(0); }
        }
      }
    ]
  });
  window.addEventListener('resize', function() { chart1.resize(); });
})();