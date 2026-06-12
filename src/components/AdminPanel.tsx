import React, { useState } from 'react';
import { Match, Prediction } from '../types';
import { AddPlayerForm } from '../features/admin/AddPlayerForm';
import { AdminDangerZone } from '../features/admin/AdminDangerZone';
import { AdminToast } from '../features/admin/AdminToast';
import { MatchEditorForm } from '../features/admin/MatchEditorForm';
import { MatchResultForm } from '../features/admin/MatchResultForm';
import { AdminToastState, ToastType } from '../features/admin/types';

interface AdminPanelProps {
  matches: Match[];
  onUpdateMatchResult: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    status: 'scheduled' | 'finished'
  ) => void;
  onSaveMatch: (
    match: Match,
    mode: 'create' | 'edit'
  ) => void | Promise<void>;
  onAddPlayer: (
    name: string,
    avatar: string,
    predictions: Record<string, Prediction>
  ) => void;
  onSyncDefaultMatches: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  matches,
  onUpdateMatchResult,
  onSaveMatch,
  onAddPlayer,
  onSyncDefaultMatches,
}) => {
  const [toast, setToast] = useState<AdminToastState | null>(null);

  const triggerToast = (
    message: string,
    type: ToastType = 'success'
  ) => {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  return (
    <div className="space-y-6 relative" id="admin-panel">
      <AdminToast toast={toast} />

      <MatchEditorForm
        matches={matches}
        onSaveMatch={onSaveMatch}
        onSuccess={(message) => triggerToast(message, 'success')}
        onError={(message) => triggerToast(message, 'error')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MatchResultForm
          matches={matches}
          onUpdateMatchResult={onUpdateMatchResult}
          onSuccess={(message) => triggerToast(message, 'success')}
        />

        <AddPlayerForm
          matches={matches}
          onAddPlayer={onAddPlayer}
          onSuccess={(message) => triggerToast(message, 'success')}
          onError={(message) => triggerToast(message, 'error')}
        />
      </div>

      <AdminDangerZone
        onSyncDefaultMatches={onSyncDefaultMatches}
        onSuccess={(message) => triggerToast(message, 'info')}
      />
    </div>
  );
};
