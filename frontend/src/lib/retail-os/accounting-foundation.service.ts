// Module 6: Accounting Foundation & Tally/Zoho Export Engine for Apka Bill V2

export type LedgerType = "cash" | "bank" | "expense" | "payment" | "receivable" | "payable";

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  referenceNumber: string;
  date: string;
}

export class AccountingFoundationService {
  private static instance: AccountingFoundationService;
  private entries: LedgerEntry[] = [];

  public static getInstance(): AccountingFoundationService {
    if (!AccountingFoundationService.instance) {
      AccountingFoundationService.instance = new AccountingFoundationService();
    }
    return AccountingFoundationService.instance;
  }

  recordTransaction(input: {
    type: LedgerType;
    accountName: string;
    debit: number;
    credit: number;
    description: string;
    referenceNumber: string;
  }): LedgerEntry {
    const lastBalance = this.entries.length > 0 ? this.entries[0].balance : 0;
    const newBalance = lastBalance + input.debit - input.credit;

    const entry: LedgerEntry = {
      id: `LED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: input.type,
      accountName: input.accountName,
      debit: input.debit,
      credit: input.credit,
      balance: newBalance,
      description: input.description,
      referenceNumber: input.referenceNumber,
      date: new Date().toISOString(),
    };

    this.entries.unshift(entry);
    return entry;
  }

  exportToTallyXml(): string {
    const vouchersXml = this.entries
      .map(
        (e) => `
    <VOUCHER VCHTYPE="Sales" ACTION="Create">
      <DATE>${e.date.split("T")[0].replace(/-/g, "")}</DATE>
      <VOUCHERNUMBER>${e.referenceNumber}</VOUCHERNUMBER>
      <NARRATION>${e.description}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${e.accountName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${e.debit > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${e.debit > 0 ? -e.debit : e.credit}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>Vouchers</REPORTNAME>\n      </REQUESTDESC>\n      <REQUESTDATA>${vouchersXml}\n      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>`;
  }

  getEntries(): LedgerEntry[] {
    return this.entries;
  }
}

export const accountingFoundationService = AccountingFoundationService.getInstance();
