const API_URL = import.meta.env.VITE_API_URL;

export const getJobs = async () => {
  const res = await fetch(`${API_URL}/jobs`);
  if (!res.ok) throw new Error("Failed to fetch jobs");
  return res.json();
};

export const getJobById = async (id) => {
  const res = await fetch(`${API_URL}/jobs/${id}`);
  if (!res.ok) throw new Error("Failed to fetch job");
  return res.json();
};

async function parseError(res, fallbackMessage) {
  try {
    const data = await res.json();
    return data.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export const applyForJob = async (data) => {
  const res = await fetch(`${API_URL}/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to submit application"));
  return res.json();
};

export const loginAdmin = async (credentials) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) throw new Error(await parseError(res, "Login failed"));
  return res.json();
};

export const signupAdmin = async (credentials) => {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) throw new Error(await parseError(res, "Signup failed"));
  return res.json();
};

export const getAuthMe = async (token) => {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to verify login"));
  return res.json();
};

export const createJob = async ({ title, description, token }) => {
  const res = await fetch(`${API_URL}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to create job"));
  return res.json();
};

export const deleteJob = async ({ id, token }) => {
  const res = await fetch(`${API_URL}/jobs/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to delete job"));
  return res.json();
};

export const getApplications = async (token) => {
  const res = await fetch(`${API_URL}/applications`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to fetch applications"));
  return res.json();
};

export const updateApplicationStatus = async ({ id, status, token }) => {
  const res = await fetch(`${API_URL}/applications/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update application status"));
  return res.json();
};

export const deleteApplication = async ({ id, token }) => {
  const res = await fetch(`${API_URL}/applications/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to remove applicant"));
  return res.json();
};
