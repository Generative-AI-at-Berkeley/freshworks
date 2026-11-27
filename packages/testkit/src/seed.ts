import type { SyntheticPerson } from './org.js';

/**
 * Rows for the BE-2 identity tables, derived from directory records the way
 * the directory sync would: one engineer per employee (latest record wins),
 * one org_unit per department, and one manager_edge per record, closed by
 * that person's next record. Column names follow docs/data-model.md. BE-2
 * owns the real tables, so if the migration names a column differently,
 * change it here, not in the tests.
 */
export interface OrgRows {
  orgUnits: { id: string; name: string }[];
  engineers: {
    employeeId: string;
    ssoSubject: string | null;
    workEmail: string;
    displayName: string;
    departmentId: string;
  }[];
  managerEdges: {
    engineerId: string;
    managerId: string;
    validFrom: Date;
    /** Null means current. */
    validTo: Date | null;
  }[];
}

export function orgRows(people: readonly SyntheticPerson[]): OrgRows {
  const byEmployee = new Map<string, SyntheticPerson[]>();
  for (const person of people) {
    const records = byEmployee.get(person.employeeId) ?? [];
    records.push(person);
    byEmployee.set(person.employeeId, records);
  }

  const engineers: OrgRows['engineers'] = [];
  const managerEdges: OrgRows['managerEdges'] = [];
  for (const records of byEmployee.values()) {
    records.sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
    const latest = records.at(-1)!;
    engineers.push({
      employeeId: latest.employeeId,
      ssoSubject: latest.ssoSubject,
      workEmail: latest.workEmail,
      displayName: latest.displayName,
      departmentId: latest.departmentId,
    });
    records.forEach((record, i) => {
      if (record.managerId === null) return;
      managerEdges.push({
        engineerId: record.employeeId,
        managerId: record.managerId,
        validFrom: record.effectiveFrom,
        validTo: records[i + 1]?.effectiveFrom ?? null,
      });
    });
  }

  const departments = [...new Set(people.map((p) => p.departmentId))].sort();
  return {
    orgUnits: departments.map((id) => ({ id, name: id })),
    engineers: engineers.sort((a, b) => a.employeeId.localeCompare(b.employeeId)),
    managerEdges,
  };
}

/** Anything with a parameterised `query`, such as a `pg` client. Keeps pg out of testkit. */
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<unknown>;
}

/** Inserts `orgRows(people)`. Run it as the table owner, before any caller-scoped query. */
export async function seedOrg(client: Queryable, people: readonly SyntheticPerson[]) {
  const rows = orgRows(people);
  for (const unit of rows.orgUnits) {
    await client.query('insert into app.org_unit (id, name) values ($1, $2)', [unit.id, unit.name]);
  }
  for (const e of rows.engineers) {
    await client.query(
      `insert into app.engineer (employee_id, sso_subject, work_email, display_name, department_id)
       values ($1, $2, $3, $4, $5)`,
      [e.employeeId, e.ssoSubject, e.workEmail, e.displayName, e.departmentId],
    );
  }
  for (const edge of rows.managerEdges) {
    await client.query(
      `insert into app.manager_edge (engineer_id, manager_id, valid_from, valid_to)
       values ($1, $2, $3, $4)`,
      [edge.engineerId, edge.managerId, edge.validFrom, edge.validTo],
    );
  }
  return rows;
}

/** Removes what `seedOrg` inserted, so a shared test database stays clean. */
export async function unseedOrg(client: Queryable, rows: OrgRows) {
  const ids = rows.engineers.map((e) => e.employeeId);
  await client.query('delete from app.manager_edge where engineer_id = any($1)', [ids]);
  await client.query('delete from app.engineer where employee_id = any($1)', [ids]);
  await client.query('delete from app.org_unit where id = any($1)', [
    rows.orgUnits.map((u) => u.id),
  ]);
}
