import fs from 'node:fs/promises';
import path from 'node:path';

const STATE_FILE = path.join(process.cwd(), 'data', 'state.json');

export async function getState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { last_processed_date: null };
    }
    throw error;
  }
}

export async function saveState(date) {
  const dir = path.dirname(STATE_FILE);

  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  const state = { last_processed_date: date };
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  console.log(`\n💾 Estado guardado com sucesso: Última data processada atualizada para [${date}]`);
}