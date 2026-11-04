import PageHeader from '../components/ui/PageHeader';
import ProfileCard from '../components/settings/ProfileCard';
import PasswordCard from '../components/settings/PasswordCard';
import SecurityCard from '../components/settings/SecurityCard';
import SheetsCard from '../components/settings/SheetsCard';
import CategoryManager from '../components/settings/CategoryManager';

export default function Settings() {
  return (
    <>
      <PageHeader title="הגדרות" subtitle="פרטי החשבון, אבטחה, גיבוי וקטגוריות" />
      <div className="space-y-6">
        <ProfileCard />
        <SecurityCard />
        <PasswordCard />
        <SheetsCard />
        <CategoryManager />
      </div>
    </>
  );
}
