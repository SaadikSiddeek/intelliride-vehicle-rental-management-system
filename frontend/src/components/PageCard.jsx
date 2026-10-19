import { Card, CardContent } from "./ui/card";
export default function PageCard({ children }) {
  return (
    <Card>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
