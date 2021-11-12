import toab from "toab";

export default async function savePRJ({ georaster }) {
    if (!georaster.srs?.wkt) {
        throw new Error("[georaster] unable to write .prj file without projection information");
    }
    return {
        data: await toab(georaster.srs.wkt)
    };
}
