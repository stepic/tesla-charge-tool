# Correzione termica della potenza di ricarica

Questa correzione applica un moltiplicatore empirico alla curva SoC -> kW
per stimare la riduzione di potenza in funzione della temperatura esterna
e della chimica della batteria. I dati della curva originale non vengono
modificati.

## Assunzioni del modello
- La temperatura esterna e usata come proxy della temperatura della batteria.
- Il moltiplicatore e applicato a ogni punto della curva: P_corr = P_curve * f_temp.
- Il limite della colonnina viene applicato dopo la correzione.
- Se la batteria e preriscaldata, f_temp = 1.

## Differenze tra chimiche
- NMC/NCA: penalizzazione moderata a basse temperature.
- LFP: penalizzazione piu marcata al freddo.
- UNKNOWN: profilo intermedio di fallback.

## Limiti noti
- Non considera stato di salute della batteria, pre-condizionamento parziale
  o effetti di isolamento termico del veicolo.
- Non modella l'inerzia termica (tempi di riscaldamento durante la carica).
- I breakpoint sono indicativi e possono differire per modello/anno.

## Configurazione ed estensione
Il modello e definito in `src/temperatureCorrection.ts` tramite:
- un tipo `BatteryChemistry`
- un set di breakpoint temperatura -> moltiplicatore
- un'interpolazione lineare tra breakpoint

Per estendere:
1. Aggiungi o modifica i breakpoint nella mappa `chemistryCurves`.
2. Aggiungi nuove voci a `BatteryChemistry` e aggiorna la UI se necessario.
3. Mantieni i moltiplicatori nell'intervallo 0..1 per evitare aumenti non realistici.
