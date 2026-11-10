import { useNavigate } from 'react-router-dom';
import { Minus, Plus, ScanLine } from 'lucide-react';
import Button from '../ui/Button';

/** The three ways to add money in or out, the same on every screen. A receipt opens the receipts screen. */
export default function AddButtons({ onAdd }) {
  const navigate = useNavigate();
  return (
    <>
      <Button variant="secondary" icon={ScanLine} onClick={() => navigate('/receipts')}>
        קבלה
      </Button>
      <Button variant="secondary" icon={Plus} onClick={() => onAdd('income')}>
        הכנסה
      </Button>
      <Button icon={Minus} onClick={() => onAdd('expense')}>
        הוצאה
      </Button>
    </>
  );
}
