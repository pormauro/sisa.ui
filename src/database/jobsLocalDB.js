import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

// Open or create local database
const db = SQLite.openDatabaseSync('mydatabase.db');

// Create local jobs table (no foreign keys)
export async function createLocalJobsTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY NOT NULL,
        client_id INTEGER,
        description TEXT,
        job_date TEXT,
        start_time TEXT,
        end_time TEXT,
        type_of_work TEXT,
        status_id INTEGER,
        folder_id INTEGER,
        product_service_id INTEGER,
        multiplicative_value REAL,
        tariff_id INTEGER,
        manual_amount REAL,
        attached_files TEXT,
        participants TEXT
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertJobLocal(jobData) {
  const {
    client_id,
    description,
    job_date,
    start_time,
    end_time,
    type_of_work,
    status_id,
    folder_id,
    product_service_id,
    multiplicative_value,
    tariff_id,
    manual_amount,
    attached_files,
    participants,
  } = jobData;
  try {
    const result = await db.runAsync(
      `INSERT INTO jobs (
        client_id, description, job_date, start_time, end_time, type_of_work, status_id,
        folder_id, product_service_id, multiplicative_value, tariff_id, manual_amount,
        attached_files, participants)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      client_id,
      description,
      job_date,
      start_time,
      end_time,
      type_of_work,
      status_id,
      folder_id,
      product_service_id,
      multiplicative_value,
      tariff_id,
      manual_amount,
      attached_files,
      participants
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function getAllJobsLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM jobs;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function deleteJobLocal(jobId) {
  try {
    const result = await db.runAsync('DELETE FROM jobs WHERE id = ?;', jobId);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

async function clearLocalJobs() {
  try {
    await db.execAsync('DELETE FROM jobs;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching jobs: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverJobs = data.jobs || [];

    if (serverJobs.length > 0) {
      await clearLocalJobs();
      await createLocalJobsTable();
      for (let j of serverJobs) {
        await insertJobLocal({
          client_id: j.client_id,
          description: j.description,
          job_date: j.job_date,
          start_time: j.start_time,
          end_time: j.end_time,
          type_of_work: j.type_of_work,
          status_id: j.status_id,
          folder_id: j.folder_id,
          product_service_id: j.product_service_id,
          multiplicative_value: j.multiplicative_value,
          tariff_id: j.tariff_id,
          manual_amount: j.manual_amount,
          attached_files: j.attached_files,
          participants: j.participants,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty jobs list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

