import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background" dir="rtl">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-light text-muted-foreground/40">404</h1>
          <div className="h-0.5 w-16 bg-border mx-auto"></div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-medium">העמוד לא נמצא</h2>
          <p className="text-muted-foreground leading-relaxed">
            העמוד <span className="font-medium text-foreground">"{pageName}"</span> לא קיים באפליקציה.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">
            <Home className="w-4 h-4 ml-2" />
            חזרה לדשבורד
          </Link>
        </Button>
      </div>
    </div>
  );
}
