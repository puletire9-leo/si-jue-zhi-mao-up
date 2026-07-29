-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: sijuelishi
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `nonstandard_carrier`
--

DROP TABLE IF EXISTS `nonstandard_carrier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nonstandard_carrier` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `carrier_key` varchar(64) NOT NULL COMMENT '载体英文键，如 guapai',
  `name` varchar(128) NOT NULL COMMENT '载体中文名，如 挂牌',
  `title_keywords` text COMMENT '标题主词，逗号分隔（suncatcher,sun catcher,...）',
  `category_paths` text COMMENT '类目路径关键词，逗号分隔（Sun Catchers,Sonnenfänger）',
  `exclude_keywords` text COMMENT '?????,????;???????,??????',
  `note` varchar(512) DEFAULT '' COMMENT '定锚说明',
  `enabled` tinyint DEFAULT '1' COMMENT '是否启用：1 启用 / 0 停用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_carrier_key` (`carrier_key`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='非标载体检索词配置';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nonstandard_carrier`
--

LOCK TABLES `nonstandard_carrier` WRITE;
/*!40000 ALTER TABLE `nonstandard_carrier` DISABLE KEYS */;
INSERT INTO `nonstandard_carrier` VALUES (1,'guapai','挂牌','suncatcher,sun catcher,sun-catcher,sonnenfänger,sonnenfanger','Sun Catchers,Sonnenfänger,Sonnenfanger','gardinenstang,gardinenschiene,vorhangziehstäbe,gardinenstab,perlen zum auffädeln,facettierte glasperlen,glasperlen zum,beads for jewelry,beads for bracelet,curtain rod,octagon bead,bastelset,diy set,perlen set,ersatzperlen,sticker,aufkleber,anti collision,kristall-suncatcher-perlen,kristallglasperlen,chicken wire,glass paint,glass prism,crystal pendant,crystals sun,prism sun,kristall prism,lamp repair,chandelier prism,chandelier connector,icicle,teardrop bead,glass teardrop,wind chime bead','亚克力 Suncatcher 窗挂为主体；plaque/sign 是旁支不入主检索',1,'2026-07-27 09:04:45','2026-07-28 06:58:32');
/*!40000 ALTER TABLE `nonstandard_carrier` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-28  8:55:44
