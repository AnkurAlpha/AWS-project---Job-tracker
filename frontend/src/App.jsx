import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Jobs from "./pages/Jobs.jsx";
import JobDetails from "./pages/JobDetails.jsx";
import Apply from "./pages/Apply.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import AdminCreateJob from "./pages/AdminCreateJob.jsx";
import Applicants from "./pages/Applicants.jsx";
import NotFound from "./pages/NotFound.jsx";
import { RequireAdmin } from "./auth/ProtectedRoute.jsx";

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/apply/:id" element={<Apply />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin/create-job"
          element={
            <RequireAdmin>
              <AdminCreateJob />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/applicants"
          element={
            <RequireAdmin>
              <Applicants />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

export default App;
