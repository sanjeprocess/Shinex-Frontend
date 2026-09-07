export interface Employee {
  epfNo: string;
  nicNo?: string;
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'Male'|'Female'|string;
  address?: string;
  homeContact?: string;
  mobile?: string;
  email?: string;

  plantCode?: string;
  sectionCode?: string;
  businessCenter?: string;
  hiredDate?: string;
  hiredMonth?: string;
  statusActive?: boolean;

  basicSalary?: number;
  dayAllowance?: number;
  nightAllowance?: number;
  sundayPoyaExtra?: number;

  bankAccountNumber?: string;
  bankName?: string;
  branchName?: string;
  branchCode?: string;
  swift?: string;

  deathDonation?: boolean;
}
