import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL;

export interface Company {
  _id: string;
  name: string;
  safeAddress: string;
  owners: string[];
  threshold: number;
  createdAt: string;
}

export const createCompany = async (data: {
  name: string;
  owners: string[];
  threshold: number;
}): Promise<Company> => {
  const response = await axios.post(`${API_BASE}/companies`, data);
  return response.data;
};

export const getAllCompanies = async (): Promise<Company[]> => {
  const response = await axios.get(`${API_BASE}/companies`);
  return response.data;
};

export const getCompanyByName = async (name: string): Promise<Company> => {
  const response = await axios.get(`${API_BASE}/companies/by-name/${name}`);
  return response.data;
};

export const getCompanySafe = async (id: string) => {
  const response = await axios.get(`${API_BASE}/companies/${id}/safe`);
  return response.data;
};

export const updateCompanyOwners = async (
  safeAddress: string,
  owners: string[]
): Promise<Company> => {
  const response = await axios.put(
    `${API_BASE}/companies/${safeAddress}/owners`,
    { owners }
  );
  return response.data;
};

export const updateCompanyThreshold = async (
  safeAddress: string,
  threshold: number
): Promise<Company> => {
  const response = await axios.put(
    `${API_BASE}/companies/${safeAddress}/threshold`,
    { threshold }
  );
  return response.data;
};

export const syncCompanyData = async (
  safeAddress: string,
  owners: string[],
  threshold: number
): Promise<Company> => {
  const response = await axios.put(
    `${API_BASE}/companies/${safeAddress}/sync`,
    { owners, threshold }
  );
  return response.data;
};
