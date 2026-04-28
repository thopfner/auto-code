const command = process.argv[2] ?? "help";

if (command === "health") {
  console.log(JSON.stringify({ ok: true, service: "auto-forge-cli" }));
} else {
  console.log("auto-forge <health>");
}
