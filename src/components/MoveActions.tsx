// The money buttons: Add money and Take out as two big tiles with their own icons, then Move and
// Set the balance as a lighter pair. Used on an account's screen and, for the main bank, on Home.
import { Icon } from './Icon';
import { openSheet, useStore } from '../state/store';
import { updateArg, type Account } from '../lib/accounts';
import { haptic } from '../lib/native';

export function MoveActions({ a, compact = false }: { a: Account; compact?: boolean }) {
  const others = useStore((s) => s.accounts.filter((x) => x.id !== a.id).length);
  const isLoan = a.kind === 'loan', isBiz = a.kind === 'business';
  const open = (arg: string) => { haptic('select'); openSheet('update', arg); };
  // on a loan the money goes the other way: paying it off takes the balance down
  const addArg = updateArg(a.id, isLoan ? 'out' : 'in');
  const outArg = updateArg(a.id, isLoan ? 'in' : 'out');
  return (
    <div className={'mv-acts' + (compact ? ' compact' : '')} role="group" aria-label="Money in and out">
      <div className="mv-two">
        <button type="button" className="mv-btn in" onClick={() => open(addArg)}>
          <span className="mv-ic"><Icon name="cashin" size={22} /></span>
          <span className="mv-t"><b>{isLoan ? 'Paid off' : 'Add money'}</b>{!compact && <small>{isLoan ? 'Lower the loan' : isBiz ? 'Sales, customers' : 'Salary or profit'}</small>}</span>
        </button>
        <button type="button" className="mv-btn out" onClick={() => open(outArg)}>
          <span className="mv-ic"><Icon name="cashout" size={22} /></span>
          <span className="mv-t"><b>{isLoan ? 'Borrowed' : 'Take out'}</b>{!compact && <small>{isLoan ? 'Add to the loan' : isBiz ? 'Suppliers, costs' : 'Spend or bills'}</small>}</span>
        </button>
      </div>
      {!compact && (
        <div className="mv-row">
          {others > 0 && <button type="button" className="mv-sm" onClick={() => open(updateArg(a.id, 'move'))}><Icon name="move" size={16} />Move to another account</button>}
          <button type="button" className="mv-sm" onClick={() => open(a.id)}><Icon name="setbal" size={16} />{isLoan ? 'Set what you owe' : isBiz ? 'Update the numbers' : 'Set the balance'}</button>
        </div>
      )}
    </div>
  );
}
