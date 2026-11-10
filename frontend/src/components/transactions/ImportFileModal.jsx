import { useState } from 'react';
import ImportStatementModal from './ImportStatementModal';
import ImportExcelModal from './ImportExcelModal';
import { useToast } from '../../context/ToastContext';

/**
 * The one import button. A bank or card statement is checked line by line; a file in
 * SmartHome's own Excel template is recognized by the server and shown as such.
 */
export default function ImportFileModal({ open, onClose, onImported }) {
  const toast = useToast();
  const [template, setTemplate] = useState(null);

  const done = (message) => {
    toast.success(message);
    onImported();
  };

  return (
    <>
      <ImportStatementModal
        open={open && !template}
        onClose={onClose}
        onTemplate={setTemplate}
        onImported={({ created, linked, skipped }) =>
          done([`יובאו ${created} תנועות`, linked && `${linked} קושרו לפריטים`, skipped && `${skipped} כבר היו במערכת`].filter(Boolean).join(', '))
        }
      />
      <ImportExcelModal
        open={Boolean(template)}
        preview={template}
        onBack={() => setTemplate(null)}
        onClose={() => {
          setTemplate(null);
          onClose();
        }}
        onImported={(count) => done(`יובאו ${count} עסקאות`)}
      />
    </>
  );
}
