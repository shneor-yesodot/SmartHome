import PageHeader from '../components/ui/PageHeader';
import ProfileCard from '../components/settings/ProfileCard';
import PasswordCard from '../components/settings/PasswordCard';
import CategoryManager from '../components/settings/CategoryManager';

export default function Settings() {
  return (
    <>
      <PageHeader title="הגדרות" subtitle="פרטי החשבון, התראות וקטגוריות" />
      <div className="space-y-6">
        <ProfileCard />
        <CategoryManager />
        <PasswordCard />
      </div>
    </>
  );
}
