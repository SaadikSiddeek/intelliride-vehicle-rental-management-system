import { LoaderCircle } from "lucide-react";
export default function TableLoading({ loading_name }) {
  return (
    <div className="table-loading" role="status" aria-live="polite">
      <LoaderCircle className="animate-spin" size={24} />
      <strong>{loading_name}</strong>
      <p>Fetching your records…</p>
      <div className="table-skeletons" aria-hidden="true"><span/><span/><span/></div>
    </div>
  );
}
