import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui/States';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        icon={Compass}
        title="העמוד לא נמצא"
        text="ייתכן שהקישור שגוי או שהעמוד הוסר."
        action={
          <Link to="/" className="btn btn-primary">
            חזרה לדשבורד
          </Link>
        }
      />
    </div>
  );
}
