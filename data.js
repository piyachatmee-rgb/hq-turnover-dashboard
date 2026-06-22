// data.js - HQ Turnover Dashboard Prototype Data Generator

const DIVISIONS = {
  "Technology": {
    departments: {
      "Software Engineering": ["Front-End Team", "Back-End Team", "QA Team"],
      "Infrastructure & DevOps": ["Cloud Team", "SecOps Team"],
      "Data & Analytics": ["Data Engineering", "Data Science", "BI Team"]
    },
    managers: [
      { id: "MGR-001", name: "ดนัย เด่นชัย", title: "Head of Software Engineering", grade: "Grade 4" },
      { id: "MGR-002", name: "กิตติพงษ์ เรืองรัตน์", title: "Head of Infrastructure", grade: "Grade 4" },
      { id: "MGR-003", name: "วิภาดา เลิศล้ำ", title: "Head of Data & Analytics", grade: "Grade 4" }
    ]
  },
  "Marketing & Branding": {
    departments: {
      "Digital Marketing": ["Performance Marketing", "Content & Social Team"],
      "Brand Management": ["Creative Team", "Public Relations"]
    },
    managers: [
      { id: "MGR-004", name: "ศิริพร งามตา", title: "Director of Marketing", grade: "Grade 4" },
      { id: "MGR-005", name: "อรรถพล รุ่งเรือง", title: "Manager of Brand Creative", grade: "Grade 3" }
    ]
  },
  "Finance & FP&A": {
    departments: {
      "Accounting": ["Accounts Payable", "Accounts Receivable"],
      "Financial Planning": ["FP&A Team", "Treasury"]
    },
    managers: [
      { id: "MGR-006", name: "ประภาส มั่นคง", title: "Director of Finance", grade: "Grade 4" },
      { id: "MGR-007", name: "จารุวรรณ ทรัพย์ดี", title: "Manager of Corporate Accounting", grade: "Grade 3" }
    ]
  },
  "People & Culture": {
    departments: {
      "HRBP": ["HRBP HQ Team"],
      "Talent Acquisition": ["Recruitment HQ Team"],
      "People Operations": ["Payroll & Compensation", "L&D Team"]
    },
    managers: [
      { id: "MGR-008", name: "พี่ชล วิชากร", title: "Director of People & Culture", grade: "Grade 5" },
      { id: "MGR-009", name: "รพีพรรณ มั่นใจ", title: "Manager of HRBP HQ", grade: "Grade 4" }
    ]
  },
  "Legal & Compliance": {
    departments: {
      "Legal Affairs": ["Corporate Legal", "Contract Management"]
    },
    managers: [
      { id: "MGR-010", name: "สุรศักดิ์ ปกป้อง", title: "General Counsel", grade: "Grade 4" }
    ]
  }
};

const JOB_GRADES = [
  { code: "Grade 1", label: "Officer / Staff" },
  { code: "Grade 2", label: "Senior Officer" },
  { code: "Grade 3", label: "Team Lead / Asst. Manager" },
  { code: "Grade 4", label: "Manager / Department Head" },
  { code: "Grade 5", label: "Director / Division Head" }
];

const EXIT_REASONS = [
  { reason: "Better Career Opportunity", type: "Voluntary", theme: "Career & Growth" },
  { reason: "Higher Compensation & Benefits", type: "Voluntary", theme: "Comp & Benefits" },
  { reason: "Relationship with Manager", type: "Voluntary", theme: "Leadership & Culture" },
  { reason: "Workload & Burnout", type: "Voluntary", theme: "Work Environment" },
  { reason: "Personal / Family Reasons", type: "Voluntary", theme: "Personal Reasons" },
  { reason: "Involuntary - Performance Issue", type: "Involuntary", theme: "Performance" },
  { reason: "Involuntary - Restructuring", type: "Involuntary", theme: "Business Restructuring" }
];

// Helper to generate a random date between two dates
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate the master employee pool (both active and terminated)
function generateEmployees(count = 800) {
  const employees = [];
  const startDateLimit = new Date("2021-01-01");
  const endDateLimit = new Date("2026-06-01");
  
  // High-level seed data generator
  for (let i = 1; i <= count; i++) {
    const empId = `HQ-${String(i).padStart(4, '0')}`;
    
    // Choose division
    const divNames = Object.keys(DIVISIONS);
    const division = divNames[Math.floor(Math.random() * divNames.length)];
    const divData = DIVISIONS[division];
    
    // Choose department
    const deptNames = Object.keys(divData.departments);
    const department = deptNames[Math.floor(Math.random() * deptNames.length)];
    
    // Choose team
    const teams = divData.departments[department];
    const team = teams[Math.floor(Math.random() * teams.length)];
    
    // Choose manager
    const manager = divData.managers[Math.floor(Math.random() * divData.managers.length)];
    
    // Hire Date: 3 to 5 years ago, some are newer
    const hireDate = randomDate(startDateLimit, new Date("2026-01-01"));
    
    // Status and Termination Date
    let status = "Active";
    let terminationDate = null;
    let exitType = null;
    let exitReasonObj = null;
    
    // Roughly 18% turnover rate over the entire 5 years
    // Give Tech and Marketing higher turnover rate for realism
    let exitProbability = 0.15;
    if (division === "Technology") exitProbability = 0.25;
    if (division === "Marketing & Branding") exitProbability = 0.20;
    
    if (Math.random() < exitProbability) {
      status = "Terminated";
      // Terminated date must be after hire date and before today (June 2026)
      const minTermDate = new Date(hireDate.getTime() + 90 * 24 * 60 * 60 * 1000); // at least 90 days after hire
      if (minTermDate < endDateLimit) {
        terminationDate = randomDate(minTermDate, endDateLimit);
        
        // Pick exit reason
        // Managers cause higher exit probability in relationship/workload
        const rVal = Math.random();
        if (rVal < 0.35) {
          exitReasonObj = EXIT_REASONS[0]; // Career
        } else if (rVal < 0.60) {
          exitReasonObj = EXIT_REASONS[1]; // Comp
        } else if (rVal < 0.75) {
          exitReasonObj = EXIT_REASONS[2]; // Manager
        } else if (rVal < 0.85) {
          exitReasonObj = EXIT_REASONS[3]; // Workload
        } else if (rVal < 0.92) {
          exitReasonObj = EXIT_REASONS[4]; // Personal
        } else if (rVal < 0.97) {
          exitReasonObj = EXIT_REASONS[5]; // Invol performance
        } else {
          exitReasonObj = EXIT_REASONS[6]; // Invol reorg
        }
        exitType = exitReasonObj.type;
      } else {
        // If min termination date is in future, keep them active
        status = "Active";
      }
    }
    
    // Job Grade
    let gradeObj = JOB_GRADES[0]; // default staff
    const rGrade = Math.random();
    if (rGrade < 0.40) gradeObj = JOB_GRADES[0]; // Staff
    else if (rGrade < 0.70) gradeObj = JOB_GRADES[1]; // Senior
    else if (rGrade < 0.88) gradeObj = JOB_GRADES[2]; // Lead/Asst Mgr
    else if (rGrade < 0.96) gradeObj = JOB_GRADES[3]; // Mgr
    else gradeObj = JOB_GRADES[4]; // Director
    
    // Performance Rating
    const rPerf = Math.random();
    let performanceRating = "Meeting Expectations";
    if (rPerf < 0.20) performanceRating = "Top Performer";
    else if (rPerf < 0.90) performanceRating = "Meeting Expectations";
    else performanceRating = "Needs Improvement";
    
    employees.push({
      employee_id: empId,
      name: `พนักงาน HQ-${i}`,
      job_title: `${gradeObj.label} (${department})`,
      job_grade: gradeObj.code,
      status: status,
      division: division,
      department: department,
      section: team, // Section represented by team here
      team: team,
      manager_id: manager.id,
      manager_name: manager.name,
      hire_date: hireDate,
      termination_date: terminationDate,
      exit_type: exitType,
      resignation_reason: exitReasonObj ? exitReasonObj.reason : null,
      exit_theme: exitReasonObj ? exitReasonObj.theme : null,
      performance_rating: performanceRating
    });
  }
  
  return employees;
}

// Generate the monthly employee snapshot table (data view on BigQuery)
function generateMonthlySnapshots(employees) {
  const snapshots = [];
  const startYear = 2023;
  const startMonth = 0; // Jan
  const endYear = 2026;
  const endMonth = 5; // Jun
  
  let current = new Date(startYear, startMonth, 1);
  const end = new Date(endYear, endMonth, 1);
  
  while (current <= end) {
    const snapshotMonthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`;
    const snapshotMonthDate = new Date(current.getFullYear(), current.getMonth(), 1);
    
    employees.forEach(emp => {
      // Was the employee hired before or during this month?
      const wasHired = emp.hire_date <= new Date(current.getFullYear(), current.getMonth() + 1, 0);
      
      // Was the employee terminated before this month?
      const wasTerminatedBefore = emp.termination_date && emp.termination_date < snapshotMonthDate;
      
      if (wasHired && !wasTerminatedBefore) {
        // Was the employee terminated during this month?
        const isExitThisMonth = emp.termination_date && 
                                emp.termination_date.getFullYear() === current.getFullYear() && 
                                emp.termination_date.getMonth() === current.getMonth();
        
        // Calculate tenure months as of this snapshot month
        let tenureMonths = 0;
        if (isExitThisMonth) {
          tenureMonths = Math.max(0, Math.round((emp.termination_date - emp.hire_date) / (30 * 24 * 60 * 60 * 1000)));
        } else {
          tenureMonths = Math.max(0, Math.round((snapshotMonthDate - emp.hire_date) / (30 * 24 * 60 * 60 * 1000)));
        }
        
        snapshots.push({
          snapshot_month: snapshotMonthStr,
          employee_id: emp.employee_id,
          name: emp.name,
          job_title: emp.job_title,
          job_grade: emp.job_grade,
          status: isExitThisMonth ? 'Terminated' : 'Active',
          division: emp.division,
          department: emp.department,
          section: emp.section,
          team: emp.team,
          manager_id: emp.manager_id,
          manager_name: emp.manager_name,
          hire_date: emp.hire_date.toISOString().split('T')[0],
          termination_date: emp.termination_date ? emp.termination_date.toISOString().split('T')[0] : null,
          tenure_months: tenureMonths,
          exit_type: isExitThisMonth ? emp.exit_type : null,
          resignation_reason: isExitThisMonth ? emp.resignation_reason : null,
          exit_theme: isExitThisMonth ? emp.exit_theme : null,
          performance_rating: emp.performance_rating,
          is_active: isExitThisMonth ? 0 : 1,
          is_exit: isExitThisMonth ? 1 : 0
        });
      }
    });
    
    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }
  
  return snapshots;
}

// Instantiate data
const employeesPool = generateEmployees(700); // 700 employees overall
const monthlySnapshots = generateMonthlySnapshots(employeesPool);

// Expose to window for app.js
window.HR_DATA = {
  employees: employeesPool,
  snapshots: monthlySnapshots,
  divisions: DIVISIONS,
  jobGrades: JOB_GRADES,
  exitReasons: EXIT_REASONS
};

console.log(`Generated ${employeesPool.length} employees and ${monthlySnapshots.length} snapshot rows.`);
