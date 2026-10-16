/**
 * Consegna un file generato dall'app all'utente.
 *
 * Sull'iPhone, nella web app aperta dalla Home, un link `download` apre
 * un'anteprima da cui non è ovvio salvare: il foglio di condivisione invece
 * offre "Salva in File", Numbers, Mail. Lo usiamo quando il browser sa
 * condividere file; altrimenti, o se l'utente lo chiude, si ripiega sul
 * download classico.
 */
export async function saveFile(
  data: Blob,
  filename: string,
  type: string,
): Promise<void> {
  const file = new File([data], filename, { type });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (error) {
      // Annullato dall'utente: ha scelto di non salvare, non insistiamo.
      if ((error as DOMException)?.name === "AbortError") return;
      // NotAllowedError (gesto utente scaduto durante il download) & co.:
      // ripieghiamo sul link.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Il click è sincrono ma il download no: lasciamo al browser il tempo di
  // leggere l'URL prima di revocarlo.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
