// app.js - HQ Turnover Dashboard Controller

document.addEventListener("DOMContentLoaded", () => {
  // Check if data is loaded
  if (!window.HR_DATA) {
    console.error("HR Data not loaded!");
    return;
  }

  // --- State ---
  const state = {
    timeFilter: "YTD", // YTD, 2025, 2024, 3years
    divisionFilter: "all",
    gradeFilter: "all",
    orgSearch: "",
    managerSearch: "",
    theme: "dark"
  };

  // --- API Configuration ---
  let useLiveAPI = false;
  const API_BASE = "http://localhost:3000/api";

  // Check if API server is online
  const checkAPIStatus = async () => {
    const statusBadge = document.getElementById("api-status-badge");
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      if (data.status === 'healthy') {
        useLiveAPI = true;
        if (statusBadge) {
          statusBadge.className = "badge badge-success";
          statusBadge.textContent = "BigQuery Live Mode";
          statusBadge.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
          statusBadge.style.color = "var(--color-success)";
        }
        console.log("Connected to BigQuery API Gateway successfully!");
      }
    } catch (e) {
      useLiveAPI = false;
      if (statusBadge) {
        statusBadge.className = "badge badge-info";
        statusBadge.textContent = "Standalone Mock Mode";
      }
      console.log("BigQuery API Gateway offline. Running in Standalone Mock Mode.");
    }
  };

  // --- DOM Elements ---
  const menuOverview = document.getElementById("menu-overview");
  const menuTraceability = document.getElementById("menu-traceability");
  const menuAccountability = document.getElementById("menu-accountability");
  const menuReasons = document.getElementById("menu-reasons");
  const menuGuide = document.getElementById("menu-guide");

  const views = {
    overview: document.getElementById("view-overview"),
    traceability: document.getElementById("view-traceability"),
    accountability: document.getElementById("view-accountability"),
    reasons: document.getElementById("view-reasons"),
    guide: document.getElementById("view-guide")
  };

  const filterContainer = document.getElementById("dashboard-filters-container");
  const selectTime = document.getElementById("global-time-filter");
  const selectDivision = document.getElementById("global-division-filter");
  const selectGrade = document.getElementById("global-grade-filter");
  const btnResetFilters = document.getElementById("reset-filters-btn");

  const orgSearchInput = document.getElementById("org-search-input");
  const managerSearchInput = document.getElementById("manager-search-input");

  const themeToggleBtn = document.getElementById("theme-toggle-btn");

  // --- Initialize Filters ---
  const populateFilters = () => {
    // Populate Division Filter
    const divisions = Object.keys(window.HR_DATA.divisions);
    divisions.forEach(div => {
      const option = document.createElement("option");
      option.value = div;
      option.textContent = div;
      selectDivision.appendChild(option);
    });

    // Populate Job Grade Filter
    const grades = window.HR_DATA.jobGrades;
    grades.forEach(grade => {
      const option = document.createElement("option");
      option.value = grade.code;
      option.textContent = `${grade.code} - ${grade.label}`;
      selectGrade.appendChild(option);
    });
  };

  populateFilters();

  // --- Tab Navigation Logic ---
  const switchTab = (activeKey) => {
    // Toggle active menu items
    [menuOverview, menuTraceability, menuAccountability, menuReasons, menuGuide].forEach(menu => {
      menu.classList.remove("active");
    });
    document.getElementById(`menu-${activeKey}`).classList.add("active");

    // Toggle views
    Object.keys(views).forEach(key => {
      views[key].classList.remove("active");
    });
    views[activeKey].classList.add("active");

    // Show/Hide global filter bar (hide for guide view)
    if (activeKey === "guide") {
      filterContainer.style.display = "none";
    } else {
      filterContainer.style.display = "flex";
    }

    // Trigger chart renders for active view
    updateDashboard();
  };

  menuOverview.addEventListener("click", () => switchTab("overview"));
  menuTraceability.addEventListener("click", () => switchTab("traceability"));
  menuAccountability.addEventListener("click", () => switchTab("accountability"));
  menuReasons.addEventListener("click", () => switchTab("reasons"));
  menuGuide.addEventListener("click", () => switchTab("guide"));

  // --- Date Range Resolvers ---
  const getDateRange = (filterType) => {
    const today = new Date();
    let startDate, endDate;

    switch (filterType) {
      case "YTD":
        startDate = "2026-01-01";
        endDate = "2026-06-01";
        break;
      case "2025":
        startDate = "2025-01-01";
        endDate = "2025-12-01";
        break;
      case "2024":
        startDate = "2024-01-01";
        endDate = "2024-12-01";
        break;
      case "3years":
      default:
        startDate = "2024-01-01";
        endDate = "2026-06-01";
        break;
    }

    return { startDate, endDate };
  };

  // --- Chart Registry (to destroy old instances on update) ---
  const chartRegistry = {};
  const destroyChart = (chartId) => {
    if (chartRegistry[chartId]) {
      chartRegistry[chartId].destroy();
      delete chartRegistry[chartId];
    }
  };

  // --- Filter and Calculate Aggregates ---
  const getFilteredData = async () => {
    const { startDate, endDate } = getDateRange(state.timeFilter);

    if (useLiveAPI) {
      try {
        const url = `${API_BASE}/snapshots?timeFilter=${state.timeFilter}&division=${state.divisionFilter}&grade=${state.gradeFilter}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
          return { filteredSnapshots: json.data, startDate, endDate };
        }
      } catch (err) {
        console.error("Failed to fetch from BigQuery API, falling back to mock data.", err);
      }
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Filter snapshots based on selected range and dimensions
    const filteredSnapshots = window.HR_DATA.snapshots.filter(row => {
      const month = new Date(row.snapshot_month);
      
      // Date filter
      if (month < start || month > end) return false;
      
      // Division filter
      if (state.divisionFilter !== "all" && row.division !== state.divisionFilter) return false;
      
      // Grade filter
      if (state.gradeFilter !== "all" && row.job_grade !== state.gradeFilter) return false;
      
      return true;
    });

    return { filteredSnapshots, startDate, endDate };
  };

  // --- Core Update Dashboard Function ---
  const updateDashboard = async () => {
    const { filteredSnapshots, startDate, endDate } = await getFilteredData();
    
    // Find all unique months in this period
    const months = [...new Set(filteredSnapshots.map(r => r.snapshot_month))].sort();
    const lastMonth = months[months.length - 1];
    
    // Calculate KPIs
    // 1. Ending Headcount (Active headcount in the last month of selected period)
    const endingSnapshots = filteredSnapshots.filter(r => r.snapshot_month === lastMonth);
    const endingHeadcount = endingSnapshots.reduce((sum, r) => sum + r.is_active, 0);

    // 2. Exits in Period
    const totalExits = filteredSnapshots.reduce((sum, r) => sum + r.is_exit, 0);

    // 3. Average Headcount (Looker Studio dynamic formula)
    const totalActiveRecordSum = filteredSnapshots.reduce((sum, r) => sum + r.is_active, 0);
    const countMonths = months.length || 1;
    const averageHeadcount = Math.round(totalActiveRecordSum / countMonths);

    // 4. Turnover Rate %
    const turnoverRate = averageHeadcount > 0 ? (totalExits / averageHeadcount) * 100 : 0;

    // 5. Regretful Exits (Top performers exited)
    const regretfulExits = filteredSnapshots.filter(r => r.is_exit === 1 && r.performance_rating === "Top Performer").length;
    const regretfulRate = averageHeadcount > 0 ? (regretfulExits / averageHeadcount) * 100 : 0;

    // Update Overview KPIs
    const kpiHeadcountEl = document.getElementById("kpi-headcount");
    const kpiExitsEl = document.getElementById("kpi-exits");
    const kpiTurnoverEl = document.getElementById("kpi-turnover-rate");
    const kpiRegretfulEl = document.getElementById("kpi-regretful-rate");

    if (kpiHeadcountEl) kpiHeadcountEl.textContent = endingHeadcount.toLocaleString();
    if (kpiExitsEl) kpiExitsEl.textContent = `${totalExits} คน`;
    if (kpiTurnoverEl) kpiTurnoverEl.textContent = `${turnoverRate.toFixed(1)}%`;
    if (kpiRegretfulEl) kpiRegretfulEl.textContent = `${regretfulRate.toFixed(1)}%`;

    // Trigger view-specific rendering
    const activeView = Object.keys(views).find(key => views[key].classList.contains("active"));
    
    if (activeView === "overview") {
      renderOverviewCharts(filteredSnapshots, months);
    } else if (activeView === "traceability") {
      renderTraceabilityData(filteredSnapshots, months);
    } else if (activeView === "accountability") {
      renderAccountabilityData(filteredSnapshots, months);
    } else if (activeView === "reasons") {
      renderReasonsCharts(filteredSnapshots);
    }
  };

  // ==============================================
  // RENDER: VIEW 1 - OVERVIEW CHARTS
  // ==============================================
  const renderOverviewCharts = (snapshots, months) => {
    // 1. Monthly Trend: Headcount (Bar) vs Turnover Rate % (Line)
    destroyChart("overviewTrend");
    
    const monthlyStats = months.map(m => {
      const monthRows = snapshots.filter(r => r.snapshot_month === m);
      const hc = monthRows.reduce((sum, r) => sum + r.is_active, 0);
      const exits = monthRows.reduce((sum, r) => sum + r.is_exit, 0);
      const rate = hc > 0 ? (exits / hc) * 100 : 0;
      
      // Format label e.g., "2026-01-01" -> "Jan 2026"
      const dateObj = new Date(m);
      const label = dateObj.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      
      return { label, hc, rate };
    });

    const ctxTrend = document.getElementById("overview-trend-chart").getContext("2d");
    chartRegistry["overviewTrend"] = new Chart(ctxTrend, {
      type: "bar",
      data: {
        labels: monthlyStats.map(s => s.label),
        datasets: [
          {
            label: "อัตราการลาออก (%)",
            type: "line",
            data: monthlyStats.map(s => s.rate),
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            borderWidth: 3,
            yAxisID: "y-rate",
            tension: 0.35,
            pointBackgroundColor: "#ef4444"
          },
          {
            label: "กำลังพลจริง (Headcount)",
            data: monthlyStats.map(s => s.hc),
            backgroundColor: "rgba(124, 58, 237, 0.45)",
            borderColor: "rgba(124, 58, 237, 0.8)",
            borderWidth: 1.5,
            yAxisID: "y-hc",
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: state.theme === "dark" ? "#e5e7eb" : "#1f2937", font: { family: "Outfit" } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563" } },
          "y-hc": {
            position: "left",
            grid: { color: state.theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" },
            ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563" },
            title: { display: true, text: "จำนวนพนักงาน (คน)", color: state.theme === "dark" ? "#9ca3af" : "#4b5563" }
          },
          "y-rate": {
            position: "right",
            grid: { display: false },
            ticks: { color: "#ef4444", callback: value => `${value}%` },
            title: { display: true, text: "อัตราการลาออก (%)", color: "#ef4444" }
          }
        }
      }
    });

    // 2. Early Attrition: Tenure Distribution Pie
    destroyChart("overviewTenure");
    const exits = snapshots.filter(r => r.is_exit === 1);
    const tenureCounts = {
      "0-3 Months (90-Day Risk)": 0,
      "3-12 Months (1-Year Risk)": 0,
      "1-3 Years (Mid Tenure)": 0,
      "3+ Years (Long Tenure)": 0
    };

    exits.forEach(row => {
      const t = row.tenure_months;
      if (t <= 3) tenureCounts["0-3 Months (90-Day Risk)"]++;
      else if (t <= 12) tenureCounts["3-12 Months (1-Year Risk)"]++;
      else if (t <= 36) tenureCounts["1-3 Years (Mid Tenure)"]++;
      else tenureCounts["3+ Years (Long Tenure)"]++;
    });

    const ctxTenure = document.getElementById("overview-tenure-pie").getContext("2d");
    chartRegistry["overviewTenure"] = new Chart(ctxTenure, {
      type: "doughnut",
      data: {
        labels: Object.keys(tenureCounts),
        datasets: [{
          data: Object.values(tenureCounts),
          backgroundColor: ["#f43f5e", "#fb923c", "#6366f1", "#10b981"],
          borderColor: state.theme === "dark" ? "#14141e" : "#ffffff",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: state.theme === "dark" ? "#e5e7eb" : "#1f2937", boxWidth: 12 }
          }
        }
      }
    });

    // 3. Turnover by Division
    destroyChart("overviewDivision");
    const divExits = {};
    const divAvgHeadcounts = {};
    const countMonthsVal = months.length || 1;

    snapshots.forEach(r => {
      if (!divExits[r.division]) divExits[r.division] = 0;
      if (!divAvgHeadcounts[r.division]) divAvgHeadcounts[r.division] = 0;
      
      divExits[r.division] += r.is_exit;
      divAvgHeadcounts[r.division] += r.is_active;
    });

    const divNames = Object.keys(divExits);
    const divTRs = divNames.map(name => {
      const avgHc = divAvgHeadcounts[name] / countMonthsVal;
      const tr = avgHc > 0 ? (divExits[name] / avgHc) * 100 : 0;
      return { name, tr, exits: divExits[name] };
    }).sort((a, b) => b.tr - a.tr);

    const ctxDiv = document.getElementById("overview-division-chart").getContext("2d");
    chartRegistry["overviewDivision"] = new Chart(ctxDiv, {
      type: "bar",
      data: {
        labels: divTRs.map(d => d.name),
        datasets: [{
          label: "Turnover Rate (%)",
          data: divTRs.map(d => d.tr),
          backgroundColor: "rgba(6, 182, 212, 0.65)",
          borderColor: "#06b6d4",
          borderWidth: 1.5,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563", callback: val => `${val}%` } },
          y: { ticks: { color: state.theme === "dark" ? "#e5e7eb" : "#1f2937" } }
        }
      }
    });

    // 4. Turnover by Job Grade
    destroyChart("overviewGrade");
    const gradeExits = {};
    const gradeAvgHeadcounts = {};

    snapshots.forEach(r => {
      if (!gradeExits[r.job_grade]) gradeExits[r.job_grade] = 0;
      if (!gradeAvgHeadcounts[r.job_grade]) gradeAvgHeadcounts[r.job_grade] = 0;
      
      gradeExits[r.job_grade] += r.is_exit;
      gradeAvgHeadcounts[r.job_grade] += r.is_active;
    });

    const gradeCodes = Object.keys(gradeExits);
    const gradeTRs = gradeCodes.map(code => {
      const avgHc = gradeAvgHeadcounts[code] / countMonthsVal;
      const tr = avgHc > 0 ? (gradeExits[code] / avgHc) * 100 : 0;
      return { code, tr };
    }).sort((a, b) => b.tr - a.tr);

    const ctxGrade = document.getElementById("overview-grade-chart").getContext("2d");
    chartRegistry["overviewGrade"] = new Chart(ctxGrade, {
      type: "bar",
      data: {
        labels: gradeTRs.map(g => g.code),
        datasets: [{
          label: "Turnover Rate (%)",
          data: gradeTRs.map(g => g.tr),
          backgroundColor: "rgba(99, 102, 241, 0.65)",
          borderColor: "#6366f1",
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563" } },
          y: { ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563", callback: val => `${val}%` } }
        }
      }
    });
  };

  // ==============================================
  // RENDER: VIEW 2 - ORGANIZATIONAL TRACEABILITY
  // ==============================================
  const renderTraceabilityData = (snapshots, months) => {
    const tableBody = document.getElementById("org-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    const countMonthsVal = months.length || 1;
    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];

    // Grouping by Division -> Department -> Team (Section)
    const orgGroup = {};

    snapshots.forEach(r => {
      const key = `${r.division}||${r.department}||${r.section}`;
      if (!orgGroup[key]) {
        orgGroup[key] = {
          division: r.division,
          department: r.department,
          section: r.section,
          startHc: 0,
          endHc: 0,
          totalExits: 0,
          activeRecordsSum: 0,
          exitTenureSum: 0
        };
      }

      if (r.snapshot_month === firstMonth) {
        orgGroup[key].startHc += r.is_active;
      }
      if (r.snapshot_month === lastMonth) {
        orgGroup[key].endHc += r.is_active;
      }
      if (r.is_exit === 1) {
        orgGroup[key].totalExits++;
        orgGroup[key].exitTenureSum += r.tenure_months;
      }
      orgGroup[key].activeRecordsSum += r.is_active;
    });

    // Populate and Filter table rows
    Object.values(orgGroup)
      .filter(item => {
        // Search filter matching division, department or section
        if (state.orgSearch) {
          const s = state.orgSearch.toLowerCase();
          return item.division.toLowerCase().includes(s) || 
                 item.department.toLowerCase().includes(s) || 
                 item.section.toLowerCase().includes(s);
        }
        return true;
      })
      .sort((a, b) => b.totalExits - a.totalExits)
      .forEach(item => {
        const avgHc = item.activeRecordsSum / countMonthsVal;
        const tr = avgHc > 0 ? (item.totalExits / avgHc) * 100 : 0;
        const avgTenureYrs = item.totalExits > 0 ? (item.exitTenureSum / item.totalExits / 12).toFixed(1) : "-";

        const trColorClass = tr > 25 ? "style='color: var(--color-danger); font-weight: bold;'" : 
                             (tr > 15 ? "style='color: var(--color-warning);'" : "");

        const row = document.createElement("tr");
        row.innerHTML = `
          <td><strong>${item.division}</strong></td>
          <td>${item.department}</td>
          <td><code>${item.section}</code></td>
          <td style="text-align: right;">${Math.round(item.startHc)}</td>
          <td style="text-align: right;">${Math.round(item.endHc)}</td>
          <td style="text-align: right; color: var(--color-danger); font-weight: 500;">${item.totalExits}</td>
          <td style="text-align: right;">${avgTenureYrs} ปี</td>
          <td style="text-align: right;" ${trColorClass}>${tr.toFixed(1)}%</td>
        `;
        tableBody.appendChild(row);
      });
  };

  // ==============================================
  // RENDER: VIEW 3 - LEADERSHIP ACCOUNTABILITY
  // ==============================================
  const renderAccountabilityData = (snapshots, months) => {
    const tableBody = document.getElementById("manager-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    const countMonthsVal = months.length || 1;

    // Grouping by Manager
    const managerGroup = {};

    snapshots.forEach(r => {
      const mKey = r.manager_id;
      if (!managerGroup[mKey]) {
        managerGroup[mKey] = {
          name: r.manager_name,
          id: r.manager_id,
          division: r.division,
          totalExits: 0,
          activeRecordsSum: 0,
          exitTenureSum: 0
        };
      }

      if (r.is_exit === 1) {
        managerGroup[mKey].totalExits++;
        managerGroup[mKey].exitTenureSum += r.tenure_months;
      }
      managerGroup[mKey].activeRecordsSum += r.is_active;
    });

    const managersList = Object.values(managerGroup).map(mgr => {
      const avgTeamSize = mgr.activeRecordsSum / countMonthsVal;
      const tr = avgTeamSize > 0 ? (mgr.totalExits / avgTeamSize) * 100 : 0;
      const avgTenure = mgr.totalExits > 0 ? (mgr.exitTenureSum / mgr.totalExits / 12) : 0;
      return { ...mgr, avgTeamSize, tr, avgTenure };
    });

    // Populate Table
    managersList
      .filter(mgr => {
        // Search filter matching name
        if (state.managerSearch) {
          return mgr.name.toLowerCase().includes(state.managerSearch.toLowerCase());
        }
        // Only show managers with at least 1 exit or team size > 0 to keep clean
        return mgr.totalExits > 0 || mgr.avgTeamSize > 0;
      })
      .sort((a, b) => b.tr - a.tr)
      .forEach(mgr => {
        const trColorClass = mgr.tr > 25 ? "style='color: var(--color-danger); font-weight: bold;'" : 
                             (mgr.tr > 15 ? "style='color: var(--color-warning);'" : "");

        const row = document.createElement("tr");
        row.innerHTML = `
          <td><strong>${mgr.name}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${mgr.id})</span></td>
          <td>${mgr.division}</td>
          <td style="text-align: right;">${mgr.avgTeamSize.toFixed(1)}</td>
          <td style="text-align: right; color: var(--color-danger); font-weight: 500;">${mgr.totalExits}</td>
          <td style="text-align: right;">${mgr.totalExits > 0 ? `${mgr.avgTenure.toFixed(1)} ปี` : "-"}</td>
          <td style="text-align: right;" ${trColorClass}>${mgr.tr.toFixed(1)}%</td>
        `;
        tableBody.appendChild(row);
      });

    // Render Scatter Chart
    destroyChart("managerScatter");
    const scatterData = managersList
      .filter(mgr => mgr.avgTeamSize > 2) // Filter out very small teams to prevent outlier distortion
      .map(mgr => ({
        x: Math.round(mgr.avgTeamSize * 10) / 10,
        y: Math.round(mgr.tr * 10) / 10,
        label: mgr.name
      }));

    const ctxScatter = document.getElementById("manager-scatter-chart").getContext("2d");
    chartRegistry["managerScatter"] = new Chart(ctxScatter, {
      type: "scatter",
      data: {
        datasets: [{
          label: "หัวหน้างาน",
          data: scatterData,
          backgroundColor: "#8b5cf6",
          borderColor: "#c084fc",
          borderWidth: 1,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = scatterData[ctx.dataIndex];
                return `${item.label}: ขนาดทีม ${item.x} คน, อัตราลาออก ${item.y}%`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: state.theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" },
            ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563" },
            title: { display: true, text: "ขนาดทีมเฉลี่ย (คน)", color: state.theme === "dark" ? "#9ca3af" : "#4b5563" }
          },
          y: {
            grid: { color: state.theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" },
            ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563", callback: val => `${val}%` },
            title: { display: true, text: "อัตรา Turnover ของทีม (%)", color: state.theme === "dark" ? "#9ca3af" : "#4b5563" }
          }
        }
      }
    });
  };

  // ==============================================
  // RENDER: VIEW 4 - ROOT CAUSE & EXIT ANALYSIS
  // ==============================================
  const renderReasonsCharts = (snapshots) => {
    const exits = snapshots.filter(r => r.is_exit === 1);

    // 1. Ranked Reasons (Horizontal Bar Chart)
    destroyChart("reasonsBar");
    const themeCounts = {};
    exits.forEach(r => {
      const theme = r.exit_theme || "Unknown";
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });

    const sortedThemes = Object.keys(themeCounts).map(theme => ({
      theme,
      count: themeCounts[theme]
    })).sort((a, b) => b.count - a.count);

    const ctxReasons = document.getElementById("reasons-bar-chart").getContext("2d");
    chartRegistry["reasonsBar"] = new Chart(ctxReasons, {
      type: "bar",
      data: {
        labels: sortedThemes.map(t => t.theme),
        datasets: [{
          label: "จำนวนคนลาออก (คน)",
          data: sortedThemes.map(t => t.count),
          backgroundColor: "rgba(139, 92, 246, 0.7)",
          borderColor: "#8b5cf6",
          borderWidth: 1.5,
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563" } },
          y: { ticks: { color: state.theme === "dark" ? "#e5e7eb" : "#1f2937" } }
        }
      }
    });

    // 2. Voluntary vs. Involuntary Pie
    destroyChart("reasonsType");
    let voluntary = 0;
    let involuntary = 0;

    exits.forEach(r => {
      if (r.exit_type === "Voluntary") voluntary++;
      else if (r.exit_type === "Involuntary") involuntary++;
    });

    const ctxType = document.getElementById("reasons-type-pie").getContext("2d");
    chartRegistry["reasonsType"] = new Chart(ctxType, {
      type: "pie",
      data: {
        labels: ["สมัครใจลาออกเอง", "เลิกจ้าง/ให้ออก"],
        datasets: [{
          data: [voluntary, involuntary],
          backgroundColor: ["#10b981", "#ef4444"],
          borderColor: state.theme === "dark" ? "#14141e" : "#ffffff",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: state.theme === "dark" ? "#e5e7eb" : "#1f2937" }
          }
        }
      }
    });

    // 3. Tenure Heatmap
    destroyChart("reasonsTenure");
    const tenureDist = {
      "0-6 เดือน": 0,
      "6-12 เดือน": 0,
      "1-2 ปี": 0,
      "2-3 ปี": 0,
      "3 ปีขึ้นไป": 0
    };

    exits.forEach(r => {
      const m = r.tenure_months;
      if (m <= 6) tenureDist["0-6 เดือน"]++;
      else if (m <= 12) tenureDist["6-12 เดือน"]++;
      else if (m <= 24) tenureDist["1-2 ปี"]++;
      else if (m <= 36) tenureDist["2-3 ปี"]++;
      else tenureDist["3 ปีขึ้นไป"]++;
    });

    const ctxTenure = document.getElementById("reasons-tenure-chart").getContext("2d");
    chartRegistry["reasonsTenure"] = new Chart(ctxTenure, {
      type: "bar",
      data: {
        labels: Object.keys(tenureDist),
        datasets: [{
          label: "พนักงานลาออก (คน)",
          data: Object.values(tenureDist),
          backgroundColor: "#fb923c",
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563" } },
          y: { ticks: { color: state.theme === "dark" ? "#9ca3af" : "#4b5563" } }
        }
      }
    });

    // 4. Performance Rating distribution (Regretful loss indicator)
    destroyChart("reasonsPerf");
    const perfCounts = {};
    exits.forEach(r => {
      const rating = r.performance_rating || "Meeting Expectations";
      perfCounts[rating] = (perfCounts[rating] || 0) + 1;
    });

    const ctxPerf = document.getElementById("reasons-perf-chart").getContext("2d");
    chartRegistry["reasonsPerf"] = new Chart(ctxPerf, {
      type: "doughnut",
      data: {
        labels: Object.keys(perfCounts),
        datasets: [{
          data: Object.values(perfCounts),
          backgroundColor: ["#10b981", "#3b82f6", "#ef4444"],
          borderColor: state.theme === "dark" ? "#14141e" : "#ffffff",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: state.theme === "dark" ? "#e5e7eb" : "#1f2937" }
          }
        }
      }
    });
  };

  // --- Filter Events ---
  selectTime.addEventListener("change", (e) => {
    state.timeFilter = e.target.value;
    updateDashboard();
  });

  selectDivision.addEventListener("change", (e) => {
    state.divisionFilter = e.target.value;
    updateDashboard();
  });

  selectGrade.addEventListener("change", (e) => {
    state.gradeFilter = e.target.value;
    updateDashboard();
  });

  btnResetFilters.addEventListener("click", () => {
    state.timeFilter = "YTD";
    state.divisionFilter = "all";
    state.gradeFilter = "all";
    
    selectTime.value = "YTD";
    selectDivision.value = "all";
    selectGrade.value = "all";
    
    if (orgSearchInput) {
      orgSearchInput.value = "";
      state.orgSearch = "";
    }
    if (managerSearchInput) {
      managerSearchInput.value = "";
      state.managerSearch = "";
    }
    
    updateDashboard();
  });

  // Search Input Events (with Debouncing style)
  if (orgSearchInput) {
    orgSearchInput.addEventListener("input", (e) => {
      state.orgSearch = e.target.value;
      const activeView = Object.keys(views).find(key => views[key].classList.contains("active"));
      if (activeView === "traceability") {
        updateDashboard();
      }
    });
  }

  if (managerSearchInput) {
    managerSearchInput.addEventListener("input", (e) => {
      state.managerSearch = e.target.value;
      const activeView = Object.keys(views).find(key => views[key].classList.contains("active"));
      if (activeView === "accountability") {
        updateDashboard();
      }
    });
  }

  // --- Theme Toggle ---
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    state.theme = newTheme;

    // Update button text / icons
    if (newTheme === "light") {
      themeToggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        <span>สลับเป็นธีมมืด</span>
      `;
    } else {
      themeToggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        <span>สลับเป็นธีมสว่าง</span>
      `;
    }

    // Rerender active charts to refresh color palettes
    updateDashboard();
  });

  // --- Initial Render ---
  const init = async () => {
    await checkAPIStatus();
    updateDashboard();
  };
  init();
});
