(()=>{
const labels={cook:'Cuisine',store:'Magasin',diet:'Diététique'};
const paths={cook:'<path d="M6 10h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM5 8h14M10 5c-2-2 2-2 0-4M14 5c-2-2 2-2 0-4M6 12H3v4h3m12-4h3v4h-3"/>',store:'<path d="M3 10h8v10H3zm10 0h8v10h-8zM8 3h8v7H8zM7 10v4m10-4v4M12 3v3"/>',diet:'<path d="M20 3C9 2 3 7 5 14c2 7 13 6 15-11ZM4 21 16 9M10 15v-5m0 5h5"/>'};
const icon=role=>'<svg class="profile-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[role]||'')+'</svg>';
const name=value=>value==='Cuisinier'?'Cuisine':value==='Magasinier'?'Magasin':value;
window.PaperChefProfiles={labels,icon,name};
})();
