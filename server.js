// server.js - Secure Node.js Express API Proxy for BigQuery

const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so the local frontend can communicate with the backend
app.use(cors());
app.use(express.json());

// Initialize BigQuery Client
// It automatically picks up credentials from the path defined in GOOGLE_APPLICATION_CREDENTIALS env variable
const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
});

// Helper: Convert time filter keywords to date strings
const getDateBounds = (timeFilter) => {
  let startDate, endDate;
  switch (timeFilter) {
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

// API Endpoint: Get Filtered Employee Snapshots from BigQuery securely
app.get('/api/snapshots', async (req, res) => {
  try {
    const { timeFilter = 'YTD', division = 'all', grade = 'all' } = req.query;
    const { startDate, endDate } = getDateBounds(timeFilter);

    // 1. Build Query Template (Securely parameterizing inputs to prevent SQL Injection)
    let query = `
      SELECT 
        snapshot_month,
        employee_id,
        job_title,
        job_grade,
        status,
        division,
        department,
        section,
        team,
        manager_id,
        manager_name,
        hire_date,
        termination_date,
        tenure_months,
        exit_type,
        resignation_reason,
        exit_theme,
        performance_rating,
        is_active,
        is_exit
      FROM \`${process.env.GCP_PROJECT_ID}.${process.env.GCP_DATASET_ID}.${process.env.GCP_TABLE_ID}\`
      WHERE 
        snapshot_month >= @startDate AND snapshot_month <= @endDate
    `;

    const queryOptions = {
      query: query,
      params: {
        startDate: startDate,
        endDate: endDate
      }
    };

    // 2. Add Conditional Filters dynamically but securely using parameters
    if (division !== 'all') {
      query += ` AND division = @division`;
      queryOptions.params.division = division;
    }
    
    if (grade !== 'all') {
      query += ` AND job_grade = @grade`;
      queryOptions.params.grade = grade;
    }

    // Reassign the modified query back to options
    queryOptions.query = query;

    console.log(`Executing query on BigQuery project: ${process.env.GCP_PROJECT_ID}...`);
    
    // 3. Execute query on BigQuery
    const [rows] = await bigquery.query(queryOptions);
    
    console.log(`Success! Fetched ${rows.length} rows from BigQuery.`);

    // Normalize BigQuery Date objects ({"value": "YYYY-MM-DD"}) to plain strings
    const normalizedRows = rows.map(row => {
      const newRow = { ...row };
      
      if (newRow.snapshot_month && typeof newRow.snapshot_month === 'object' && newRow.snapshot_month.value) {
        newRow.snapshot_month = newRow.snapshot_month.value;
      }
      if (newRow.hire_date && typeof newRow.hire_date === 'object' && newRow.hire_date.value) {
        newRow.hire_date = newRow.hire_date.value;
      }
      if (newRow.termination_date && typeof newRow.termination_date === 'object' && newRow.termination_date.value) {
        newRow.termination_date = newRow.termination_date.value;
      }
      
      return newRow;
    });

    // 4. Return sanitized data (Names are stripped out in SELECT to maintain privacy)
    res.json({
      success: true,
      count: normalizedRows.length,
      data: normalizedRows
    });

  } catch (error) {
    console.error("BigQuery Connection Error: ", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch data from BigQuery",
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', database: 'BigQuery Connection Configured' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 HQ Attrition Secure API Server running on port ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=================================================`);
});
