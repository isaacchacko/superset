import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getEffortsHome, readEffortDetails } from ".";

describe("readEffortDetails", () => {
	it("reads effort.json and tasks.json from the effort's home folder", async () => {
		const home = mkdtempSync(join(tmpdir(), "efforts-"));
		mkdirSync(join(home, "demo"));
		writeFileSync(
			join(home, "demo", "effort.json"),
			JSON.stringify({ name: "Demo effort", prs: [{ number: 7 }] }),
		);
		writeFileSync(
			join(home, "demo", "tasks.json"),
			JSON.stringify([{ id: "t1", title: "Ship it", status: "doing" }]),
		);

		const details = await readEffortDetails("demo", home);

		expect(details.name).toBe("Demo effort");
		expect(details.pullRequestNumbers).toEqual([7]);
		expect(details.tasks.map((task) => task.title)).toEqual(["Ship it"]);
	});

	it("returns empty details for an effort with no files on this machine", async () => {
		const home = mkdtempSync(join(tmpdir(), "efforts-"));
		const details = await readEffortDetails("elsewhere", home);
		expect(details.name).toBeNull();
		expect(details.tasks).toEqual([]);
	});
});

describe("getEffortsHome", () => {
	it("honours EFFORT_HOME like the effort CLI", () => {
		expect(getEffortsHome({ EFFORT_HOME: "/tmp/e" })).toBe("/tmp/e");
		expect(getEffortsHome({}).endsWith(".efforts")).toBe(true);
	});
});
