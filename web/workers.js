/**
 * The workers the search runs in (search-worker.js; app.js, split on 26/10/2026), created on first use: one asked for
 * each choice of the shown day, others for whole days.
 */
const workers = [];
let jobs = 0;

const workerAt = (i) => {
  workers[i] ??= new Worker(new URL("./search-worker.js", import.meta.url), { type: "module" });
  return workers[i];
};

/** Asks worker `i` for `message`'s answer. */
export function ask(i, message) {
  const worker = workerAt(i);
  const job = ++jobs;
  return new Promise((resolve, reject) => {
    const done = ({ data }) => {
      if (data.job !== job) return;
      worker.removeEventListener("message", done);
      resolve(data);
    };
    worker.addEventListener("message", done);
    worker.onerror = (error) => reject(error);
    worker.postMessage({ ...message, job });
  });
}

/** Every worker stopped (a new day, a new plan): the answers of a search under way would be for another day. */
export function stopWorkers() {
  for (const worker of workers.splice(0)) worker.terminate();
}
