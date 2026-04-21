import "@testing-library/jest-dom/vitest";

process.env.DATABASE_URL ??=
  "postgresql://zcap:zcap@localhost:5432/zcap_voting_test?schema=public";
