/**
 * Импорт LAS-файлов из браузера.
 *
 * Схема: File[] (кнопка или перетаскивание) → arrayBuffer → decodeLasBytes → parseLas
 *        → store.addLasDataset() по каждому файлу; ошибки → store.setMessage().
 */
import { decodeLasBytes, LasError, parseLas } from '../data/las'
import { useAppStore } from '../state/store'

/**
 * Загружает LAS-файлы в набор данных.
 *
 * @param files - выбранные файлы; расширение не важно (Камертон выгружает LAS и в .txt),
 *                формат проверяется по содержимому (секции ~C и ~A).
 * @returns промис, который завершается после обработки всех файлов.
 */
export async function importLasFiles(files: Iterable<File>): Promise<void> {
  const { addLasDataset, setMessage } = useAppStore.getState()
  for (const file of files) {
    try {
      setMessage({ kind: 'info', text: `${file.name}: загрузка…` })
      // Дать браузеру отрисовать сообщение перед разбором большого файла.
      await new Promise((resolve) => setTimeout(resolve, 0))
      const result = parseLas(decodeLasBytes(await file.arrayBuffer()))
      addLasDataset(result, file.name)
    } catch (error) {
      const reason = error instanceof LasError ? error.message : 'файл не удалось прочитать'
      if (!(error instanceof LasError)) console.error(error)
      setMessage({ kind: 'error', text: `${file.name}: ${reason}` })
    }
  }
}

/**
 * Открывает системный диалог выбора файлов и импортирует выбранные LAS.
 */
export function pickLasFiles(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.las,.LAS,.txt,.TXT'
  input.multiple = true
  input.addEventListener('change', () => {
    if (input.files) void importLasFiles(Array.from(input.files))
  })
  input.click()
}
