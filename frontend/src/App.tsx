import { useDashboard } from "./hooks/useDashboard";
import { Layout } from "./ui/Layout";

export default function App() {
  return <Layout d={useDashboard()} />;
}
