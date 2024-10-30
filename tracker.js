import { select, input } from '@inquirer/prompts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import moment from 'moment';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, 'expenses.json');

// Helper functions to read and write expense data
function getExpenses() {
  if (fs.existsSync(dataFile)) {
    return JSON.parse(fs.readFileSync(dataFile));
  }
  return [];
}

function saveExpenses(expenses) {
  fs.writeFileSync(dataFile, JSON.stringify(expenses, null, 2));
}

// Expense manager functions
async function addExpense() {
  const category = await input({
    message: 'Expense Category (e.g., Food, Transport):',
  });
  const amount = await input({
    message: 'Amount:',
  });
  const currency = await input({
    message: 'Currency (e.g., USD, EUR):',
  });

  const expenses = getExpenses();
  expenses.push({
    category,
    amount: parseFloat(amount),
    currency,
    date: moment().format('YYYY-MM-DD'),
  });
  saveExpenses(expenses);
  console.log(chalk.green('Expense added successfully!'));
}

function listExpenses() {
  const expenses = getExpenses();
  console.log(chalk.blue('\nYour Expenses:'));
  expenses.forEach((expense, index) => {
    console.log(
      `${index + 1}. [${expense.category}] $${expense.amount} ${
        expense.currency
      } - Date: ${expense.date}`
    );
  });
}

async function generatePDFReport() {
  const expenses = getExpenses();
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream('expenses_report.pdf'));

  doc.fontSize(20).text('Monthly Expenses Report', { align: 'center' });
  doc.moveDown();
  expenses.forEach(expense => {
    doc
      .fontSize(12)
      .text(
        `[${expense.date}] ${expense.category}: $${expense.amount} ${expense.currency}`
      );
  });

  doc.end();
  console.log(chalk.green('PDF report generated: expenses_report.pdf'));
}

async function visualizeExpenses() {
  const expenses = getExpenses();
  const categories = [...new Set(expenses.map(expense => expense.category))];
  const data = categories.map(category =>
    expenses
      .filter(expense => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0)
  );

  const chart = new ChartJSNodeCanvas({ width: 600, height: 400 });
  const config = {
    type: 'pie',
    data: {
      labels: categories,
      datasets: [
        {
          label: 'Expenses by Category',
          data,
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
          ],
        },
      ],
    },
  };

  const image = await chart.renderToBuffer(config);
  fs.writeFileSync('expenses_chart.png', image);
  console.log(chalk.green('Expense chart generated: expenses_chart.png'));
}

async function convertCurrency(amount, fromCurrency, toCurrency) {
  try {
    const response = await axios.get(
      `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`
    );
    const rate = response.data.rates[toCurrency];
    return (amount * rate).toFixed(2);
  } catch (error) {
    console.error(chalk.red('Error fetching currency rate:', error.message));
  }
}

// Currency conversion and listing in a different currency
async function listInDifferentCurrency() {
  const targetCurrency = await input({
    message: 'Convert expenses to (e.g., USD, EUR):',
  });

  const expenses = getExpenses();
  console.log(chalk.blue(`\nExpenses in ${targetCurrency}:`));
  for (const expense of expenses) {
    const convertedAmount = await convertCurrency(
      expense.amount,
      expense.currency,
      targetCurrency
    );
    console.log(
      `[${expense.category}] $${convertedAmount} ${targetCurrency} - Date: ${expense.date}`
    );
  }
}

// CLI Menu
async function showMenu() {
  console.log(chalk.yellow('\nPersonal Finance Tracker'));

  const action = await select({
    message: 'Choose an action:',
    choices: [
      { name: 'Add Expense', value: 'add' },
      { name: 'List Expenses', value: 'list' },
      { name: 'Generate PDF Report', value: 'pdf' },
      { name: 'Visualize Expenses', value: 'visualize' },
      { name: 'List in Different Currency', value: 'convert' },
      { name: 'Exit', value: 'exit' },
    ],
  });

  switch (action) {
    case 'add':
      await addExpense();
      break;
    case 'list':
      listExpenses();
      break;
    case 'pdf':
      await generatePDFReport();
      break;
    case 'visualize':
      await visualizeExpenses();
      break;
    case 'convert':
      await listInDifferentCurrency();
      break;
    case 'exit':
      console.log(chalk.yellow('Goodbye!'));
      process.exit();
      break;
  }

  showMenu();
}

showMenu();
