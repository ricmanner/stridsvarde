DROP INDEX `notifications_unique_per_day`;--> statement-breakpoint
ALTER TABLE `notifications` ADD `requested_by_user_id` integer REFERENCES users(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_talk_per_day` ON `notifications` (`recipient_user_id`,`requested_by_user_id`,`service_date`) WHERE kind = 'talk_request';--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_unique_per_day` ON `notifications` (`recipient_user_id`,`subject_unit_id`,`kind`,`service_date`) WHERE kind <> 'talk_request';--> statement-breakpoint
-- drizzle-kit tappade ON DELETE CASCADE på raden ovan trots att schemat anger
-- det. Utan det går en värnpliktig som bett om samtal inte att radera — och
-- inte heller enheten hon tillhör. Tillagt för hand.
--
-- Befintliga samtalsbegäran sparades som 'red_values'. De flyttas till sin
-- egen sort, så att larmregler och unikhetsvillkor inte längre blandar ihop
-- dem med larm. Vem som bad kan inte härledas i efterhand; kolumnen förblir
-- tom för dem.
UPDATE `notifications` SET `kind` = 'talk_request'
 WHERE `title` IN ('En värnpliktig vill prata med dig', 'En soldat vill prata med dig');--> statement-breakpoint
-- Olästa larm som redan ersatts av ett nyare om samma enhet och sak markeras
-- som lästa. Annars staplades de: "Pluton 1 ligger på kritisk nivå" en gång
-- per dag tills befälet kvitterade varje.
UPDATE `notifications` SET `read_at` = `created_at`
 WHERE `read_at` IS NULL
   AND `kind` <> 'talk_request'
   AND EXISTS (
     SELECT 1 FROM `notifications` AS `nyare`
      WHERE `nyare`.`recipient_user_id` = `notifications`.`recipient_user_id`
        AND `nyare`.`subject_unit_id` = `notifications`.`subject_unit_id`
        AND `nyare`.`kind` = `notifications`.`kind`
        AND `nyare`.`read_at` IS NULL
        AND `nyare`.`service_date` > `notifications`.`service_date`
   );
