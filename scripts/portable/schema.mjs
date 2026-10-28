// Shared descriptors drive runtime projection and the published JSON Schema.
const string={type:'string',maxLength:1000000},bool={type:'boolean'},number={type:'number'},integer={type:'integer',minimum:0},uuid={type:'string',maxLength:512,pattern:'^[A-Za-z0-9_.-]*$'},image={...string,format:'image-path'};
const id={type:'string',maxLength:128,pattern:'^[A-Za-z0-9_-]+$'};
const object=properties=>({type:'object',properties,additionalProperties:true});
const array=items=>({type:'array',items,maxItems:2000});
const resourceValue={anyOf:[{type:'number',minimum:1e-18,maximum:1000000},{type:'string',maxLength:32,pattern:'^(?=.*[1-9])(?:(?:0|[1-9][0-9]{0,5})(?:[.][0-9]{1,18})?|1000000(?:[.]0{1,18})?)$'}]};
const json={};
const text=keys=>Object.fromEntries(keys.split(' ').filter(Boolean).map(key=>[key,string]));
const source=array(json);
const common={id,...text('title details notes status type legacyStatus legacyType referenceTitle referenceName referencePack referenceType referenceWarning detailsFormat'),uuid,portrait:image,imageSrc:image,titleOverride:bool,quantity:{type:'number',minimum:0},collected:bool,typeSource:string,resource:string,generated:object({method:string,threatCategory:string,threatSeverity:integer,threatMode:string,sources:source}),generation:object({method:string,sources:source}),actorImport:object({version:{const:1},uuid}),role:string,disposition:string,factionId:string};
const entry=object({...common,duration:string,category:string,macroUuid:uuid,triggerId:string,macroRunOnce:bool,macroEnabled:bool,macroDisabled:bool});
const inhabitant=object(common),project=object({...common,progress:string,completedAt:string,arkSource:{...object({version:{const:1},arkUuid:{...uuid,pattern:'^[A-Za-z0-9_.-]+$'},projectUuid:{...uuid,pattern:'^[A-Za-z0-9_.-]+$'},missing:bool}),required:['version','arkUuid','projectUuid','missing']}});
const member=object({id,uuid,actorUuid:uuid});
const faction=object({...common,...text('info description leader goals resources relationship allies rivals tensions'),infoVersion:{const:1},membersVersion:{const:1},members:array({anyOf:[uuid,member]}),actors:array({anyOf:[uuid,member]}),actorUuids:array(uuid)});
const shopEntry=object({id,uuid,legacyEntryId:string,passengers:string,travelType:{enum:['Land','Water']}});
const group=object({id,name:string,type:string,entries:array(shopEntry)});
const legacyInventory=object({...common,price:{anyOf:[string,number]},quantity:{anyOf:[string,number]}});
const legacyShop=object({...common,proprietor:string,inventory:array(legacyInventory)});
const supplies=object(Object.fromEntries('cleanGrub rotGrub cleanWater rotWater bullets booze components'.split(' ').map(key=>[key,object({quantity:{type:'number',minimum:0},collected:bool})])));
export const SECTOR_SCHEMA=object({
 version:{const:1},sectorType:{enum:['normal','special','settlement']},nameOverride:bool,customName:string,...text('terrain status description notes mood'),rot:{anyOf:[string,number]},threatLevel:integer,
 locations:array(entry),encounters:array(entry),effects:array(entry),loot:array(entry),secrets:array(entry),history:array(entry),supplies,
 pathStunts:object(Object.fromEntries('safePath artifact assessRot bullets grub water halfTime rush saferRoute'.split(' ').map(key=>[key,bool]))),
 travel:object({mode:{enum:['foot','vehicle']},...Object.fromEntries('rushed stalker open difficult night'.split(' ').map(key=>[key,bool])),difficulty:{type:'number',minimum:2}}),
 special:object({overlayImage:image,sceneUuid:uuid,...text('source overview situation'),images:array(entry),locations:array(entry),inhabitants:array(inhabitant),gear:array(entry),events:array(entry)}),
 settlement:object({version:{const:1},...text('type disposition population leadership description notes history situation defenses resources economy'),image,arkUuid:uuid,projects:array(project),inhabitants:array(inhabitant),factions:array(faction),events:array(object({...common,...text('trigger outcomes related')})),threads:array(object({...common,...text('npcs factions clues developments resolution')})),shops:array(legacyShop),shop:object({version:{const:1},playerAccess:bool,trading:object({enabled:bool,values:object(Object.fromEntries(['bullets','cleanGrub','cleanWater','booze'].map(key=>[key,resourceValue])))}),groups:array(group),migration:object({version:{const:1},source:string,unlinked:integer,duplicates:integer})})}),
 randomization:object({method:string,threatLevel:string,numericThreatLevel:integer,levelSelection:json,environment:object({name:string,ruins:{anyOf:[string,{type:'null'}]},threats:bool,artifacts:bool,manual:bool}),baseDice:array({type:'integer',minimum:1,maximum:6}),rolledOnes:integer,rolledSixes:integer,threatSeverity:integer,threatCount:integer,artifactCount:integer,threatMode:string,sources:source})
});
SECTOR_SCHEMA.required=['sectorType'];
export const PORTABLE_SCHEMA={
 $schema:'https://json-schema.org/draft/2020-12/schema',title:'MYZ Sector Manager single-sector export',type:'object',required:['format','formatVersion','schemaVersion','sector'],additionalProperties:true,
 properties:{format:{const:'myz-sector-manager'},formatVersion:{const:1},schemaVersion:{const:1},exportedBy:object({module:{const:'myz-sector-manager'},version:{type:'string',pattern:'^\\d+\\.\\d+\\.\\d+$'}}),source:object({coordinates:string,name:string}),sector:SECTOR_SCHEMA,extensions:object({unknown:array(object({path:array({anyOf:[string,integer]}),value:json}))})}
};
