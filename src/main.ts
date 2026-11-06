import './style.css';
import { pasangTabJadwal } from './ui/tab-jadwal';

function pasangTab(): void {
  const tombol = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab button'));
  for (const b of tombol) {
    b.addEventListener('click', () => {
      for (const lain of tombol) {
        const aktif = lain === b;
        lain.setAttribute('aria-selected', String(aktif));
        document.getElementById(lain.getAttribute('aria-controls')!)!.hidden = !aktif;
      }
    });
  }
}

pasangTab();
pasangTabJadwal(document.getElementById('tab-jadwal')!);
